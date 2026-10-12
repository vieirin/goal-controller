/**
 * MutRoSe's definition pool (goal-controller#59): four providers (the goal
 * model, the world, the HDDL domain, the configuration) and the glue
 * between them: which HDDL task a goal-model task stands for, which world
 * class a type names, and the checks that span the files, each reported in
 * the file the reference is in.
 */
import {
  definePool,
  type PoolDefinition,
  type PoolDiagnostic,
  type PoolLookup,
  type PoolReference,
} from '../../definitionPool';
import { createHddlProvider } from '../../definitionPool/providers/hddl';
import {
  configurationProvider,
  roleOf,
  standsFor,
  type ConfigRole,
} from './configuration';
import { readOclExpression } from './ocl';
import {
  BASIC_TYPES,
  modelField,
  modelNodes,
  modelProvider,
  oclOf,
} from './model';
import { worldProvider } from './world';

export * from './configuration';
export * from './model';
export * from './world';

/**
 * The project's other goal models (a domain may be shared by several): a
 * document of this kind is read by the checks, not indexed.
 */
export const OTHER_MODEL = 'otherModel';

/** The class a type is of: `Room` for `Sequence(Room)`. */
const classOfType = (type: string): string =>
  /^Sequence\((\w+)\)$/.exec(type)?.[1] ?? type;

const list = (definitions: readonly PoolDefinition[]) =>
  definitions.length
    ? ` (it has ${definitions.map((d) => d.name).join(', ')})`
    : '';

const error = (
  reference: PoolReference,
  check: string,
  message: string,
  severity: PoolDiagnostic['severity'] = 'error',
): PoolDiagnostic => ({ ...reference.location, severity, message, check });

/** The configuration's references with a role, unresolved. */
const unresolvedOf = (pool: PoolLookup, role: ConfigRole) =>
  pool.references().filter((r) => roleOf(r) === role && !pool.target(r));

/** The references in a model field (`Params`, `name`) of a kind. */
const inModelField = (pool: PoolLookup, field: string, kind: string) =>
  pool
    .references()
    .filter(
      (r) =>
        modelField(r.location.document)?.field === field &&
        r.kinds.includes(kind),
    );

/** How many instances a world class has. */
const instancesOf = (pool: PoolLookup, worldClass: PoolDefinition) =>
  pool.definitionsOf('world.instance').filter((i) => i.type === worldClass.name)
    .length;

/** The checks across MutRoSe's files. */
const checks = (pool: PoolLookup): PoolDiagnostic[] => {
  const diagnostics: PoolDiagnostic[] = [];
  const hasModel = pool.has('model');
  const hasHddl = pool.has('hddl');
  const hasWorld = pool.has('world');
  const hasConfiguration = pool.has('configuration');
  const tasks = pool.definitionsOf('hddl.task');

  // a goal-model task whose HDDL task the domain doesn't have
  if (hasHddl)
    for (const name of inModelField(pool, 'name', 'hddl.task'))
      if (!pool.target(name))
        diagnostics.push(
          error(
            name,
            'unknown-hddl-task',
            `${name.name} is not a task of the HDDL domain${list(tasks)}`,
          ),
        );

  if (hasConfiguration && hasModel) {
    // a task's Params its var_mapping doesn't bind
    const bindings = new Map<string, Set<string>>();
    const taskRefs = pool.references().filter((r) => roleOf(r) === 'taskId');
    for (const reference of pool.references()) {
      if (roleOf(reference) !== 'gmVar') continue;
      // the var_mapping entry it is in: the last task_id before it
      const entry = taskRefs
        .filter(
          (t) =>
            t.location.document === reference.location.document &&
            t.location.from < reference.location.from,
        )
        .pop();
      if (entry)
        bindings.set(
          entry.name,
          (bindings.get(entry.name) ?? new Set()).add(reference.name),
        );
    }
    for (const param of inModelField(pool, 'Params', 'gm.variable')) {
      const element = modelField(param.location.document)!.element;
      const node = [...pool.documents.values()]
        .filter((d) => d.kind === 'model')
        .flatMap(modelNodes)
        .find(([key]) => key === element)?.[1];
      const id = node?.id ?? element;
      if (!bindings.get(id)?.has(param.name)) {
        const task = pool.find(['gm.task'], id);
        const hddlTask = task && standsFor(task, pool);
        diagnostics.push(
          error(
            param,
            'unbound-param',
            `${param.name} is bound to no parameter${hddlTask ? ` of ${pool.definition(hddlTask)!.name}` : ''}: the configuration's var_mapping for ${id} doesn't map it`,
          ),
        );
      }
    }
  }

  // a bound hddl_var that isn't the HDDL task's parameter
  if (hasHddl && hasModel)
    for (const variable of unresolvedOf(pool, 'hddlVar')) {
      const scope = variable.scope;
      const task = scope && 'via' in scope ? pool.target(scope.via) : undefined;
      const hddlTask = task && standsFor(task, pool);
      if (!hddlTask) continue;
      const params = pool
        .definitionsOf('hddl.param')
        .filter((p) => p.owner === hddlTask);
      diagnostics.push(
        error(
          variable,
          'hddl-var-not-param',
          `${variable.name} is not a parameter of ${pool.definition(hddlTask)!.name}${list(params)}`,
        ),
      );
    }

  // a mapping to what doesn't exist
  if (hasModel) {
    for (const task of unresolvedOf(pool, 'taskId'))
      diagnostics.push(
        error(
          task,
          'unknown-mapping-task',
          `${task.name} is not a task of the goal model${list(pool.definitionsOf('gm.task'))}`,
        ),
      );
    for (const variable of unresolvedOf(pool, 'gmVar'))
      diagnostics.push(
        error(
          variable,
          'unknown-mapping-variable',
          `${variable.name} is not a variable the goal model declares`,
        ),
      );
  }
  if (hasHddl)
    for (const role of ['hddlType', 'argSort'] as const)
      for (const type of unresolvedOf(pool, role))
        diagnostics.push(
          error(
            type,
            'unknown-mapping-type',
            `${type.name} is not a type of the HDDL domain${list(pool.definitionsOf('hddl.type'))}`,
          ),
        );
  if (hasWorld)
    for (const role of ['oclType', 'locationType', 'relatesTo'] as const)
      for (const type of unresolvedOf(pool, role))
        diagnostics.push(
          error(
            type,
            'unknown-mapping-class',
            `${type.name} is not a class of the world knowledge${list(pool.definitionsOf('world.class'))}`,
          ),
        );

  // an HDDL task no goal-model task stands for and no method decomposes into
  // (the project's other models count: they may share the domain)
  if (hasModel && hasHddl) {
    const otherModels = new Set(
      [...pool.documents.values()]
        .filter((d) => d.kind === OTHER_MODEL)
        .flatMap(modelNodes)
        .flatMap(([, node]) =>
          node.kind === 'task'
            ? [/\S+/.exec(node.name)?.[0].toLowerCase() ?? '']
            : [],
        ),
    );
    for (const task of tasks) {
      const used =
        otherModels.has(task.name.toLowerCase()) ||
        pool.referencesTo(task.id).some(
          (r) =>
            r.location.document.startsWith('model:') ||
            // a method's subtask (its own `:task` is a task's definition, not a use)
            r.kinds.includes('hddl.action'),
        );
      if (!used)
        diagnostics.push({
          ...task.location,
          severity: 'warning',
          check: 'unused-hddl-task',
          message: `No task of the goal model stands for ${task.name}, and no method decomposes into it`,
        });
    }
  }

  // a select or a forAll over a class the world has no instance of
  if (hasWorld) {
    for (const type of inModelField(pool, 'QueriedProperty', 'world.class')) {
      const target = pool.target(type);
      if (target && !instancesOf(pool, target))
        diagnostics.push(
          error(
            type,
            'no-instances',
            `${type.name} has no instances in the world knowledge: this select finds nothing`,
            'warning',
          ),
        );
    }
    for (const document of pool.documents.values()) {
      if (document.kind !== 'model') continue;
      for (const [key, node] of modelNodes(document)) {
        const condition = node.properties.AchieveCondition;
        const ocl =
          condition !== undefined && oclOf('AchieveCondition', condition);
        if (!ocl) continue;
        for (const { iterated } of readOclExpression(ocl.text, ocl.offset).value
          .forAlls) {
          if (!iterated || iterated.attributes.length) continue;
          const variable = pool.find(['gm.variable'], iterated.head.name);
          const className = variable?.type && classOfType(variable.type);
          const worldClass =
            className && !BASIC_TYPES.has(className)
              ? pool.find(['world.class'], className)
              : undefined;
          if (worldClass && !instancesOf(pool, worldClass))
            diagnostics.push({
              document: `model:${key}:AchieveCondition`,
              from: iterated.head.from,
              to: iterated.head.to,
              severity: 'warning',
              check: 'no-instances',
              message: `${iterated.head.name} is a ${variable!.type}, and the world knowledge has no ${className}: this forAll has nothing to iterate`,
            });
        }
      }
    }
  }
  return diagnostics;
};

/** MutRoSe's pool: what an editor of a MutRoSe project serves every tab from. */
export const mutrosePool = definePool({
  engine: 'mutrose',
  providers: [
    modelProvider,
    worldProvider,
    // the decomposer's domains use types (`robot`) they don't list
    createHddlProvider({ typesDeclaredByUse: true }),
    configurationProvider,
  ],
  checks,
  resolvers: {
    // a goal-model task: the HDDL task it stands for
    'gm.standsFor': (task, pool) => standsFor(task, pool),
    // a world class: its own members
    self: (definition) => definition.id,
  },
  // a type names a world class (a collection's, its element's)
  typeDefinition: (type, pool) => {
    const name = classOfType(type);
    return BASIC_TYPES.has(name)
      ? undefined
      : pool.find(['world.class'], name)?.id;
  },
});

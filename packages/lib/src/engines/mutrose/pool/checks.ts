/**
 * MutRoSe's checks across its files that a declaration can't say: they
 * read the typed, resolved pool (its definitions, references, links and
 * the files' typed values), never how it was read or resolved. What
 * resolves to nothing is the declarations' (`unresolved`), not these.
 */
import type { Check, Definition, Reference, TypedPool } from '../../../pool';
import { OTHER_MODEL } from '../files/goalModel';

/** A model element, as the pool reads it. */
type Element = {
  key: string;
  id: string;
  kind: string;
  name: string;
  properties: Record<string, string>;
};
type Configuration = {
  var_mapping?: { task_id: string; map: { gm_var: string }[] }[];
};

/** The model field a name is written in (`Params` in `model:AT1:Params`). */
const fieldOf = ({ location }: Reference | Definition) =>
  /^model:.*:([^:]*)$/.exec(location.document)?.[1];
/** The model element a name is written in (`AT1`): its key. */
const elementKey = ({ location }: Reference | Definition) =>
  /^model:(.*):[^:]*$/.exec(location.document)?.[1];

/** The AST node (or object) a value is in. */
type Node = { $type?: string; $container?: Node; [key: string]: unknown };
const parentOf = (located: Reference | Definition) =>
  located.parent as Node | undefined;

const elementsOf = (pool: TypedPool, file: string) =>
  pool
    .values(file)
    .flatMap(({ value }) => (value as Element[] | undefined) ?? []);

/** a task's Params its var_mapping doesn't bind */
export const unboundParam: Check = (pool) => {
  if (!pool.has('configuration') || !pool.has('model')) return [];
  const bound = new Map<string, Set<string>>();
  for (const { value } of pool.values('configuration'))
    for (const entry of (value as Configuration | undefined)?.var_mapping ?? [])
      for (const { gm_var } of entry.map)
        bound.set(
          entry.task_id,
          (bound.get(entry.task_id) ?? new Set()).add(gm_var),
        );
  const ids = new Map(elementsOf(pool, 'model').map((e) => [e.key, e.id]));
  return pool
    .references('gm.variable')
    .filter((param) => param.file === 'model' && fieldOf(param) === 'Params')
    .flatMap((param) => {
      const id = ids.get(elementKey(param)!) ?? elementKey(param)!;
      if (bound.get(id)?.has(param.name)) return [];
      const task = pool.find('gm.task', id);
      const [hddlTask] = pool.links('standsFor', task);
      return [
        param.problem('error', 'unbound-param', {
          name: param.name,
          task: id,
          hddlTask: hddlTask?.name ?? '',
        }),
      ];
    });
};

/**
 * an HDDL task no goal-model task stands for and no method decomposes into
 * (the project's other models count: they may share the domain)
 */
export const unusedHddlTask: Check = (pool) => {
  if (!pool.has('model') || !pool.has('hddl')) return [];
  const others = new Set(
    elementsOf(pool, OTHER_MODEL).flatMap((element) =>
      element.kind === 'task'
        ? [/\S+/.exec(element.name)?.[0].toLowerCase() ?? '']
        : [],
    ),
  );
  return pool
    .definitions('hddl.task')
    .filter(
      (task) =>
        !others.has(task.name.toLowerCase()) &&
        !pool.referencesTo(task).some(
          (use) =>
            use.file === 'model' ||
            // a method's subtask (its own `:task` is a task's, not a use)
            parentOf(use)?.$type === 'SubtaskBody',
        ),
    )
    .map((task) =>
      task.problem('warning', 'unused-hddl-task', { name: task.name }),
    );
};

/** a select or a forAll over a class the world has no instance of */
export const noInstances: Check = (pool) => {
  if (!pool.has('world')) return [];
  const instances = (worldClass: Definition) =>
    pool.definitions('world.instance').filter((i) => i.type === worldClass.name)
      .length;
  const selects = pool
    .references('world.class')
    .filter(
      (type) =>
        fieldOf(type) === 'QueriedProperty' &&
        parentOf(type)?.$type === 'OclType' &&
        type.target &&
        !instances(type.target),
    )
    .map((type) =>
      type.problem('warning', 'no-instances', { name: type.name }),
    );
  const forAlls = pool.references('gm.variable').flatMap((iterated) => {
    const path = parentOf(iterated);
    const call = path?.$container;
    if (
      fieldOf(iterated) !== 'AchieveCondition' ||
      path?.$type !== 'OclPath' ||
      (path.attributes as unknown[]).length ||
      call?.$type !== 'OclCall' ||
      call.operation !== 'forAll' ||
      call.source !== path ||
      !iterated.target
    )
      return [];
    const worldClass = pool.typeOf(iterated.target);
    return worldClass && !instances(worldClass)
      ? [
          iterated.problem('warning', 'no-instances', {
            name: iterated.name,
            type: iterated.target.type ?? '',
            class: worldClass.name,
          }),
        ]
      : [];
  });
  return [...selects, ...forAlls];
};

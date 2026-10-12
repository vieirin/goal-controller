/**
 * MutRoSe's configuration in the definition pool (goal-controller#59):
 * what each of its mappings refers to, in the other three files. A
 * `location_types` entry defines a location type, and is the world class it
 * names; `var_mapping` binds a goal-model task's variables to the
 * parameters of the HDDL task that task stands for.
 */
import {
  jsonEntry,
  readJsonTree,
  type JsonNode,
  type JsonRange,
} from '../../jsonTree';
import type {
  PoolCompletion,
  PoolDefinition,
  PoolDocument,
  PoolFacts,
  PoolLookup,
  PoolProvider,
  PoolReference,
} from '../../definitionPool';

const PROVIDER = 'mutrose';

/** A string of the configuration, and where its content is. */
export type ConfigString = { value: string; range: JsonRange };

/** What the configuration maps, with where (each part may be missing). */
export type ConfigMappings = {
  locationTypes: ConfigString[];
  typeMapping: { hddlType?: ConfigString; oclType?: ConfigString }[];
  varMapping: {
    taskId?: ConfigString;
    map: { gmVar?: ConfigString; hddlVar?: ConfigString }[];
  }[];
  semanticMapping: {
    relatesTo?: ConfigString;
    name?: ConfigString;
    pred?: ConfigString;
    argSorts: ConfigString[];
  }[];
};

const stringOf = (node: JsonNode | undefined): ConfigString | undefined =>
  node?.type === 'string'
    ? { value: node.value, range: node.inner }
    : undefined;

/** The robots the decomposer brings (no class of the world's) */
const ROBOTS = new Set(['robot', 'robotteam']);

/**
 * A world class a string names: `Room`, or `Room` in `Sequence(Room)`;
 * none for the decomposer's robots.
 */
const classString = (
  string: ConfigString | undefined,
): ConfigString | undefined => {
  if (!string || ROBOTS.has(string.value)) return undefined;
  const inner = /^(Sequence\()(\w+)\)$/.exec(string.value);
  return inner
    ? {
        value: inner[2]!,
        range: {
          from: string.range.from + inner[1]!.length,
          to: string.range.from + inner[1]!.length + inner[2]!.length,
        },
      }
    : string;
};
const itemsOf = (node: JsonNode | undefined): JsonNode[] =>
  node?.type === 'array' ? node.items : [];

/** The configuration's mappings, read from its text (none when it isn't JSON). */
export const readMappings = (text: string): ConfigMappings => {
  const root = readJsonTree(text) ?? undefined;
  const get = (node: JsonNode | undefined, key: string) =>
    jsonEntry(node, key)?.value;
  return {
    locationTypes: itemsOf(get(root, 'location_types')).flatMap(
      (item) => stringOf(item) ?? [],
    ),
    typeMapping: itemsOf(get(root, 'type_mapping')).map((item) => ({
      hddlType: stringOf(get(item, 'hddl_type')),
      oclType: classString(stringOf(get(item, 'ocl_type'))),
    })),
    varMapping: itemsOf(get(root, 'var_mapping')).map((item) => ({
      taskId: stringOf(get(item, 'task_id')),
      map: itemsOf(get(item, 'map')).map((pair) => ({
        gmVar: stringOf(get(pair, 'gm_var')),
        hddlVar: stringOf(get(pair, 'hddl_var')),
      })),
    })),
    semanticMapping: itemsOf(get(root, 'semantic_mapping')).map((item) => {
      // what the world says: not a robot's attribute (`robots_db`)
      const world =
        (stringOf(get(item, 'belongs_to'))?.value ?? 'world_db') === 'world_db';
      const relatesTo = world
        ? classString(stringOf(get(item, 'relates_to')))
        : undefined;
      return {
        relatesTo,
        name:
          relatesTo && stringOf(get(item, 'type'))?.value === 'attribute'
            ? stringOf(get(item, 'name'))
            : undefined,
        pred: stringOf(get(get(item, 'map'), 'pred')),
        argSorts: itemsOf(get(get(item, 'map'), 'arg_sorts')).flatMap(
          (sort) => stringOf(sort) ?? [],
        ),
      };
    }),
  };
};

/** Where a configuration's reference is, by role: what its checks report on. */
export type ConfigRole =
  | 'locationType'
  | 'oclType'
  | 'hddlType'
  | 'taskId'
  | 'gmVar'
  | 'hddlVar'
  | 'relatesTo'
  | 'attribute'
  | 'predicate'
  | 'argSort';

/** A reference with its role: the checks read them by role. */
const roles = new WeakMap<PoolReference, ConfigRole>();
export const roleOf = (reference: PoolReference): ConfigRole | undefined =>
  roles.get(reference);

const extract = (document: PoolDocument): PoolFacts => {
  const definitions: PoolDefinition[] = [];
  const references: PoolReference[] = [];
  const mappings = readMappings(document.text ?? '');
  const refer = (
    role: ConfigRole,
    kinds: string[],
    string: ConfigString | undefined,
    scope?: PoolReference['scope'],
  ): PoolReference | undefined => {
    if (!string) return undefined;
    const reference: PoolReference = {
      kinds,
      name: string.value,
      location: { document: document.id, ...string.range },
      ...(scope && { scope }),
    };
    roles.set(reference, role);
    references.push(reference);
    return reference;
  };
  for (const type of mappings.locationTypes) {
    definitions.push({
      id: `${PROVIDER}.locationType:${type.value}`,
      kind: `${PROVIDER}.locationType`,
      name: type.value,
      location: { document: document.id, ...type.range },
      detail: 'a class a task’s Location may be',
    });
    refer('locationType', ['world.class'], type);
  }
  for (const { hddlType, oclType } of mappings.typeMapping) {
    refer('hddlType', ['hddl.type'], hddlType);
    refer('oclType', ['world.class'], oclType);
  }
  for (const { taskId, map } of mappings.varMapping) {
    const task = refer('taskId', ['gm.task'], taskId);
    for (const { gmVar, hddlVar } of map) {
      refer('gmVar', ['gm.variable'], gmVar);
      // the parameters of the HDDL task the model's task stands for
      if (task)
        refer('hddlVar', ['hddl.param'], hddlVar, {
          via: task,
          through: 'gm.standsFor',
        });
    }
  }
  for (const { relatesTo, name, pred, argSorts } of mappings.semanticMapping) {
    const owner = refer('relatesTo', ['world.class'], relatesTo);
    if (owner)
      refer('attribute', ['world.attribute'], name, {
        via: owner,
        through: 'self',
      });
    // a predicate, or a numeric function (`staphylococcus`)
    refer('predicate', ['hddl.predicate', 'hddl.function'], pred);
    for (const sort of argSorts) refer('argSort', ['hddl.type'], sort);
  }
  return { definitions, references };
};

/** The string key a configuration's value is written under, before an offset (and its `task_id`). */
const contextAt = (text: string, offset: number) => {
  const before = text.slice(0, offset);
  const value = /"((?:[^"\\]|\\.)*)$/.exec(before);
  if (!value) return null;
  const outside = before.slice(0, value.index);
  const key = /"(\w+)"\s*:\s*$/.exec(outside)?.[1];
  const inList = /"(location_types|arg_sorts)"\s*:\s*\[[^\]]*$/.exec(
    outside,
  )?.[1];
  const taskId = [...outside.matchAll(/"task_id"\s*:\s*"([^"]*)"/g)].pop()?.[1];
  return { partial: value[1]!, key: key ?? inList, taskId };
};

const complete = (
  pool: PoolLookup,
  document: PoolDocument,
  offset: number,
): PoolCompletion[] => {
  const context = contextAt(document.text ?? '', offset);
  if (!context?.key) return [];
  const from = offset - context.partial.length;
  const of = (definitions: readonly PoolDefinition[]) =>
    definitions.map((d) => ({
      label: d.name,
      kind: d.kind,
      detail: d.detail ?? d.type,
      from,
      to: offset,
    }));
  switch (context.key) {
    case 'task_id':
      return of(pool.definitionsOf('gm.task'));
    case 'gm_var':
      return of(pool.definitionsOf('gm.variable').filter((v) => !v.owner));
    case 'hddl_var': {
      const task = context.taskId
        ? pool.find(['gm.task'], context.taskId)
        : undefined;
      const hddlTask = task && standsFor(task, pool);
      return hddlTask
        ? of(
            pool
              .definitionsOf('hddl.param')
              .filter((p) => p.owner === hddlTask),
          )
        : [];
    }
    case 'hddl_type':
    case 'arg_sorts':
      return of(pool.definitionsOf('hddl.type'));
    case 'ocl_type':
    case 'location_types':
    case 'relates_to':
      return of(pool.definitionsOf('world.class'));
    case 'pred':
      return of([
        ...pool.definitionsOf('hddl.predicate'),
        ...pool.definitionsOf('hddl.function'),
      ]);
    default:
      return [];
  }
};

/** The HDDL task a goal-model task stands for: its first word's (the `gm.standsFor` resolver). */
export const standsFor = (
  task: PoolDefinition,
  pool: PoolLookup,
): string | undefined => {
  const element = /^model:(.*):id$/.exec(task.location.document)?.[1];
  if (element === undefined) return undefined;
  const name = pool
    .references()
    .find(
      (r) =>
        r.location.document === `model:${element}:name` &&
        r.kinds.includes('hddl.task'),
    );
  return name ? pool.target(name)?.id : undefined;
};

export const configurationProvider: PoolProvider = {
  id: PROVIDER,
  documents: { resources: ['configuration'] },
  kinds: { locationType: { label: 'Location type' } },
  refers: [
    'world.class',
    'world.attribute',
    'hddl.type',
    'hddl.param',
    'hddl.predicate',
    'hddl.function',
    'gm.task',
    'gm.variable',
  ],
  extract,
  complete,
  // a JSON string: no quote or backslash
  renameText: (_definition, newName) =>
    /^[^"\\]+$/.test(newName) ? newName : null,
};

/**
 * MutRoSe's configuration (`configuration/configuration.json`), and the
 * checks across MutRoSe's four files (#59), as rules: the configuration maps
 * the goal model onto the HDDL domain and the world, so its provider holds
 * what joins them.
 */
import {
  ref,
  type PoolFacts,
  type PoolProvider,
  type PoolReference,
} from '../core/types';
import { inside, member, readJsonNode, type JsonNode } from '../readers/json';

const strings = (
  node: JsonNode | undefined,
): (JsonNode & { type: 'string' })[] =>
  node?.type === 'array'
    ? node.items.filter(
        (item): item is JsonNode & { type: 'string' } => item.type === 'string',
      )
    : [];
const stringOf = (node: JsonNode | undefined) =>
  node?.type === 'string' ? node : undefined;
const objects = (node: JsonNode | undefined) =>
  node?.type === 'array'
    ? node.items.filter((item) => item.type === 'object')
    : [];

export const mutroseProvider: PoolProvider = {
  id: 'mutrose',
  documents: { resources: ['configuration'] },
  kinds: { locationType: { label: 'location type' } },
  refers: [
    'world.root',
    'world.class',
    'hddl.type',
    'hddl.param',
    'gm.task',
    'gm.variable',
  ],
  extract: ({ id: document, text = '' }) => {
    const facts: Required<PoolFacts> = {
      definitions: [],
      references: [],
      relations: [],
    };
    const root = readJsonNode(text);
    if (root?.type !== 'object') return facts;
    facts.relations.push(['mutrose.configured', document]);
    let counter = 0;
    const refer = (
      kinds: string[],
      node: JsonNode & { type: 'string' },
      scope?: PoolReference['scope'],
    ) => {
      const reference: PoolReference = {
        kinds,
        name: node.value,
        location: { document, ...inside(node) },
        id: `c${counter++}`,
        ...(scope && { scope }),
      };
      facts.references.push(reference);
      return reference;
    };
    const xmlRoot = stringOf(
      member(member(root, 'world_db')?.value, 'xml_root')?.value,
    );
    if (xmlRoot) refer(['world.root'], xmlRoot);
    for (const location of strings(member(root, 'location_types')?.value)) {
      refer(['world.class'], location);
      facts.definitions.push({
        id: `mutrose.locationType:${location.value}`,
        kind: 'mutrose.locationType',
        name: location.value,
        location: { document, ...inside(location) },
      });
    }
    for (const mapping of objects(member(root, 'type_mapping')?.value)) {
      const hddl = stringOf(member(mapping, 'hddl_type')?.value);
      const ocl = stringOf(member(mapping, 'ocl_type')?.value);
      if (!hddl || !ocl) continue;
      facts.relations.push([
        'mutrose.typeMap',
        ref(refer(['hddl.type'], hddl).id!),
        ref(refer(['world.class'], ocl).id!),
      ]);
    }
    for (const entry of objects(member(root, 'var_mapping')?.value)) {
      const taskId = stringOf(member(entry, 'task_id')?.value);
      if (!taskId) continue;
      const task = refer(['gm.task'], taskId);
      for (const pair of objects(member(entry, 'map')?.value)) {
        const gmVar = stringOf(member(pair, 'gm_var')?.value);
        const hddlVar = stringOf(member(pair, 'hddl_var')?.value);
        if (!gmVar || !hddlVar) continue;
        facts.relations.push([
          'mutrose.binding',
          ref(task.id!),
          ref(refer(['gm.variable'], gmVar).id!),
          // a parameter of the HDDL task the goal model's task stands for
          ref(
            refer(['hddl.param'], hddlVar, {
              via: task,
              through: 'mutrose.standsFor',
            }).id!,
          ),
        ]);
      }
    }
    return facts;
  },
  rules: `
    % a goal-model task stands for the HDDL task its name's first word names
    through('mutrose.standsFor', G, H) :- gm.namesTask(G, R), resolves(R, H).

    % #59: a task's Params that its var_mapping doesn't bind
    mutrose.bound(T, N) :- mutrose.binding(TR, GV, _), resolves(TR, T), name(GV, N).
    problem(P, error, 'mutrose.unboundParam', '') :- mutrose.configured(_), gm.param(T, P), name(P, N), !mutrose.bound(T, N).

    % #59: an hddl_var whose parameter's type doesn't take the variable's class,
    % through type_mapping and HDDL's subtypes (recursive: hddl.subtypeOf)
    mutrose.classOf(X, C) :- typeBase(X, T), defines(C, 'world.class', T).
    mutrose.hddlTypeOf(C, H) :- mutrose.typeMap(HR, OR), resolves(OR, C), resolves(HR, H).
    problem(HV, error, 'mutrose.paramType', '') :- mutrose.binding(_, GV, HV), resolves(GV, G), mutrose.classOf(G, C), mutrose.hddlTypeOf(C, H), resolves(HV, P), hddl.paramType(P, PR), resolves(PR, PT), !hddl.subtypeOf(H, PT).

    % #59: a select or forAll over a class with no instances
    problem(R, warning, 'mutrose.noInstances', '') :- gm.selects(R), resolves(R, C), !world.hasInstance(C).
    problem(R, warning, 'mutrose.iteratesNoInstances', '') :- gm.iterates(R), resolves(R, V), mutrose.classOf(V, C), !world.hasInstance(C).
  `,
  messages: {
    'mutrose.unboundParam':
      'No var_mapping of this task binds `{name}` to an HDDL parameter',
    'mutrose.paramType':
      'The HDDL parameter `{name}` doesn’t take this variable’s type (see type_mapping)',
    'mutrose.noInstances':
      '{name} has no instances in the world knowledge: this select finds nothing',
    'mutrose.iteratesNoInstances':
      '`{name}` iterates over a class with no instances in the world knowledge',
  },
};

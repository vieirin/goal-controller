/**
 * MutRoSe's configuration (`configuration/configuration.json`) as facts
 * (goal-controller#75): where its world is, which classes are locations, and
 * how the goal model's types and variables map onto the HDDL domain's.
 * configuration.rls: the checks that join the four files.
 */
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
  type RuleReference,
  type RuleRelation,
} from '../../ruleFacts/facts';
import {
  inside,
  member,
  readJsonNode,
  type JsonNode,
} from '../../ruleFacts/json';

export const CONFIGURATION_KINDS: Readonly<Record<string, KindDefinition>> = {
  'mutrose.locationType': { label: 'location type' },
};

type JsonString = JsonNode & { type: 'string' };
const strings = (node: JsonNode | undefined): JsonString[] =>
  node?.type === 'array'
    ? node.items.filter((item): item is JsonString => item.type === 'string')
    : [];
const stringOf = (node: JsonNode | undefined) =>
  node?.type === 'string' ? node : undefined;
const objects = (node: JsonNode | undefined) =>
  node?.type === 'array'
    ? node.items.filter((item) => item.type === 'object')
    : [];

export const readConfiguration = (
  document: string,
  text: string,
): DocumentFacts => {
  const relations: RuleRelation[] = [];
  const facts: DocumentFacts = {
    document,
    text,
    definitions: [],
    references: [],
    relations,
  };
  const root = readJsonNode(text);
  if (root?.type !== 'object') return facts;
  relations.push(['mutrose_configured', document]);
  let counter = 0;
  const refer = (
    kinds: string[],
    node: JsonString,
    scope?: RuleReference['scope'],
  ) => {
    const reference: RuleReference = {
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
    relations.push([
      'mutrose_typeMap',
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
      relations.push([
        'mutrose_binding',
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
};

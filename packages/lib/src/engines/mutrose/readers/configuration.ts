/**
 * MutRoSe's configuration (`configuration/configuration.json`), typed
 * (goal-controller#79): where its world is, which classes are locations, and
 * how the goal model's types and variables map onto the HDDL domain's. Its
 * facts (#75) are the references configuration.rls joins across the four
 * files.
 */
import * as z from 'zod/mini';
import { read, type Reader } from '../../../readers';
import { parseJson } from '../../../readers/json';
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
  type RuleReference,
  type RuleRelation,
} from '../../ruleFacts/facts';

const TypeMapping = z.strictObject({
  hddl_type: z.string(),
  ocl_type: z.string(),
});

const VarMapping = z.strictObject({
  task_id: z.string(),
  map: z.array(z.strictObject({ gm_var: z.string(), hddl_var: z.string() })),
});

/** The keys the decomposer reads; any other is a warning. */
export const configurationSchema = z.strictObject({
  world_db: z.optional(
    z.strictObject({
      type: z.optional(z.string()),
      file_type: z.optional(z.string()),
      path: z.optional(z.string()),
      xml_root: z.optional(z.string()),
    }),
  ),
  output: z.optional(z.record(z.string(), z.string())),
  location_types: z.optional(z.array(z.string())),
  type_mapping: z.optional(z.array(TypeMapping)),
  var_mapping: z.optional(z.array(VarMapping)),
  semantic_mapping: z.optional(z.array(z.unknown())),
});

export type ConfigurationFile = z.infer<typeof configurationSchema>;

export const CONFIGURATION_KINDS: Readonly<Record<string, KindDefinition>> = {
  'mutrose.locationType': { label: 'location type' },
};

export const configurationReader: Reader<ConfigurationFile, DocumentFacts> = {
  parse: parseJson,
  schema: configurationSchema,
  facts: (configuration, at, document) => {
    const relations: RuleRelation[] = [['mutrose_configured', document]];
    const facts: DocumentFacts = {
      document,
      text: '',
      definitions: [],
      references: [],
      relations,
    };
    const located = (path: (string | number)[]) => {
      const { from, to } = at(path)!;
      return { document, from, to };
    };
    let counter = 0;
    const refer = (
      kinds: string[],
      name: string,
      path: (string | number)[],
      scope?: RuleReference['scope'],
    ) => {
      const reference: RuleReference = {
        kinds,
        name,
        location: located(path),
        id: `c${counter++}`,
        ...(scope && { scope }),
      };
      facts.references.push(reference);
      return reference;
    };
    const xmlRoot = configuration.world_db?.xml_root;
    if (xmlRoot !== undefined)
      refer(['world.root'], xmlRoot, ['world_db', 'xml_root']);
    configuration.location_types?.forEach((location, i) => {
      refer(['world.class'], location, ['location_types', i]);
      facts.definitions.push({
        id: `mutrose.locationType:${location}`,
        kind: 'mutrose.locationType',
        name: location,
        location: located(['location_types', i]),
      });
    });
    configuration.type_mapping?.forEach(({ hddl_type, ocl_type }, i) =>
      relations.push([
        'mutrose_typeMap',
        ref(
          refer(['hddl.type'], hddl_type, ['type_mapping', i, 'hddl_type']).id!,
        ),
        ref(
          refer(['world.class'], ocl_type, ['type_mapping', i, 'ocl_type']).id!,
        ),
      ]),
    );
    configuration.var_mapping?.forEach(({ task_id, map }, i) => {
      const task = refer(['gm.task'], task_id, ['var_mapping', i, 'task_id']);
      map.forEach(({ gm_var, hddl_var }, j) => {
        const pair = ['var_mapping', i, 'map', j];
        relations.push([
          'mutrose_binding',
          ref(task.id!),
          ref(refer(['gm.variable'], gm_var, [...pair, 'gm_var']).id!),
          // a parameter of the HDDL task the goal model's task stands for
          ref(
            refer(['hddl.param'], hddl_var, [...pair, 'hddl_var'], {
              via: task,
              through: 'mutrose.standsFor',
            }).id!,
          ),
        ]);
      });
    });
    return facts;
  },
};

/** The configuration's facts (none when it isn't a configuration). */
export const readConfiguration = (
  document: string,
  text: string,
): DocumentFacts => {
  const { facts } = read(configurationReader, document, text);
  return facts
    ? { ...facts, text }
    : { document, text, definitions: [], references: [], relations: [] };
};

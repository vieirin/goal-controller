/**
 * An engine's part of an agent's context (goal-controller#415): the kinds
 * its dialect lists, every property's schema, and the constraints the
 * dialect declares, as data. One helper over the dialect for every engine
 * (`defineEngine` gives each engine with a dialect its own); an engine that
 * needs lines of its own passes them in `constraints`. The notation's part
 * is goal-language's (`notationHelpOf`); the root's (the framework's own
 * element and link kinds) is `@istar-ts/actions`' own `metamodelContext`
 * (goal-controller#450), never restated here.
 */
import type {
  AnyDialect,
  Condition,
  PropertyDefinition,
  ValueConfig,
} from '@goal-controller/dialect';

/** A property's schema: its key, its value in words (from its value config), and its help. */
export type PropertySchema = {
  key: string;
  value: string;
  help: string;
  /** when the engine reads it (none: always) */
  applies?: string;
};

/** The properties of one owner: an element kind, a link kind, or `actor`. */
export type OwnerSchema = {
  owner: string;
  /** an element kind's id prefix, if its lines have one */
  prefix?: string;
  properties: readonly PropertySchema[];
};

export type EngineContext = {
  dialect: string;
  /** the element kinds its Notation view lists, with their id prefixes */
  kinds: readonly { kind: string; prefix: string | null }[];
  /** the link kinds it gives properties */
  links: readonly string[];
  /** every element, link and actor property it declares */
  properties: readonly OwnerSchema[];
  /** what a model must keep: required properties, link chains to close, and the engine's own */
  constraints: readonly string[];
};

const describeValue = (value: ValueConfig): string => {
  switch (value.type) {
    case 'enum':
      return `one of: ${value.options.map((o) => o.value || '(unset)').join(', ')}${value.open ? ', or free text' : ''}`;
    case 'int':
    case 'number':
      return `${value.type === 'int' ? 'an int' : 'a number'}${value.min !== undefined ? `, min ${value.min}` : ''}${value.max !== undefined ? `, max ${value.max}` : ''}`;
    case 'text':
      return 'free text';
    case 'bool':
      return 'true or false';
    case 'assertion':
      return `a condition over ${value.resolves.join(', ')}`;
    case 'expression':
      return `a numeric expression${value.resolves ? ` over ${value.resolves.join(', ')}` : ''}`;
    case 'refList':
      return `ids of ${'kind' in value ? value.kind : value.kinds.join(' or ')}, comma-separated`;
    case 'pairList':
      return `name:value pairs, comma-separated (${value.value} values)`;
    case 'nameList':
      return 'names, comma-separated';
    case 'annotatedName':
      return 'a line without an id';
    case 'reference':
      return 'a name of its target';
    case 'formula':
      return `a ${value.language} formula`;
    case 'probability':
      return 'a probability (0.8, or 80%)';
    case 'distribution':
      return 'a probability distribution';
    case 'ocl':
      return 'an OCL expression';
  }
};

const describeCondition = (condition: Condition): string | null =>
  condition === 'always'
    ? null
    : 'when' in condition
      ? `when ${condition.when.key} = ${condition.when.equals}`
      : `unless ${condition.not.when.key} = ${condition.not.when.equals}`;

const schemaOf = (property: PropertyDefinition): PropertySchema => {
  const applies = property.applies && describeCondition(property.applies);
  return {
    key: property.key,
    value:
      'when' in property.value
        ? `${describeValue(property.value.matching)} (when ${property.value.when.key} = ${property.value.when.equals}), else ${describeValue(property.value.otherwise)}`
        : describeValue(property.value),
    help: property.help,
    ...(applies && { applies }),
  };
};

type Owner = [OwnerSchema, readonly PropertyDefinition[]];

const owner = (
  name: string,
  list: readonly PropertyDefinition[],
  prefix?: string,
): Owner => [
  {
    owner: name,
    ...(prefix !== undefined && { prefix }),
    properties: list.map(schemaOf),
  },
  list,
];

/** Each owner's properties: its element kinds', its link kinds', its actors'. */
const ownersOf = (dialect: AnyDialect): Owner[] => [
  ...Object.entries(dialect.properties).map(([kind, list]) =>
    owner(kind, list, dialect.elements[kind]?.prefix),
  ),
  ...Object.entries(dialect.links ?? {}).map(([kind, list]) =>
    owner(kind, list),
  ),
  ...(dialect.actors && dialect.actors.length > 0
    ? [owner('actor', dialect.actors)]
    : []),
];

/**
 * An engine's context, from its dialect alone: its kinds, links, actors,
 * properties, and the constraints its data declares (required properties,
 * link chains to close), with the engine's own `constraints` after them.
 */
export const engineContextOf = (
  dialect: AnyDialect,
  { constraints = [] }: { constraints?: readonly string[] } = {},
): EngineContext => {
  const owners = ownersOf(dialect);
  return {
    dialect: dialect.name,
    kinds: Object.entries(dialect.elements).map(([kind, element]) => ({
      kind,
      prefix: element?.prefix ?? null,
    })),
    links: Object.keys(dialect.links ?? {}),
    properties: owners
      .map(([schema]) => schema)
      .filter((schema) => schema.properties.length > 0),
    constraints: [
      ...owners.flatMap(([{ owner }, list]) =>
        list.flatMap(({ key, required }) => {
          if (!required) return [];
          const when = describeCondition(required);
          return [`${owner}.${key} is required${when ? ` ${when}` : ''}`];
        }),
      ),
      ...(dialect.closures ?? []).map(
        ({ path: [first, second], closedBy }) =>
          `where a ${first} ends where a ${second} starts, a ${closedBy} joins the first's source to the second's target`,
      ),
      ...constraints,
    ],
  };
};

/** The same, as plain text: a system prompt's section. */
export const engineContextText = (context: EngineContext): string =>
  [
    `kinds: ${context.kinds.map(({ kind, prefix }) => (prefix ? `${kind} (${prefix})` : kind)).join(', ')}`,
    ...context.properties.map(({ owner, prefix, properties }) =>
      [
        prefix ? `${owner} (id prefix ${prefix})` : owner,
        ...properties.map(
          ({ key, value, help, applies }) =>
            `  - ${key}: ${value}${applies ? `, read ${applies}` : ''} — ${help}`,
        ),
      ].join('\n'),
    ),
    context.constraints.length > 0 &&
      [
        'constraints:',
        ...context.constraints.map((line) => `  - ${line}`),
      ].join('\n'),
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n\n');

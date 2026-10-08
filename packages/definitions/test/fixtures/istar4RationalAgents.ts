/**
 * piStar-ext's mechanisms, written with the schema as it is (Gonçalves et al.,
 * "piStar-ext", iStar 2020, Figs. 1, 3 and 4): stereotypes `<<action>>` and
 * tagged values `{type = duty}` are annotations setting properties, a grouper
 * is a list of kinds the same properties are declared on. Then its example,
 * iStar4RationalAgents, over EdgeV2: the stereotype `action` and the tagged
 * value `type ∈ {duty, right}` on tasks. What the schema cannot say (the
 * rational grouper's stereotypes are on actors and roles; Planning and Plan are
 * new kinds of node) is in docs/pistar-ext-support.md.
 */
import {
  defineEngine,
  edgeV2,
  type ConditionalValue,
  type DeclarationDefinition,
  type ElementKind,
  type EngineDefinition,
  type PropertyDefinition,
  type ValueConfig,
} from '../../src';

/** `<<goal-based>>`: one stereotype, as piStar-ext stores it. */
export const stereotypeAnnotation = {
  delimiters: ['<<', '>>'],
  parts: [{ key: 'stereotype', pattern: '[^<>]*[^<>\\s]' }],
} as const satisfies DeclarationDefinition;

/** `{Id = G1}`, or piStar-ext's own `{Id=G1}`: one tagged value, its name and value. */
export const taggedValueAnnotation = {
  delimiters: ['{', '}'],
  parts: [
    { key: 'tag', pattern: '[^{}=]*[^{}=\\s]' },
    {
      optional: [
        { literal: ' = ' },
        { key: 'tagValue', pattern: '[^{}]*[^{}\\s]' },
      ],
    },
  ],
} as const satisfies DeclarationDefinition;

/** The tagged values piStar-ext offers on every element (its paper's [4]). */
export const DEFAULT_TAGS = ['Id', 'Reference to', 'Status', 'Logic'];

const options = (values: readonly string[]) => [
  { value: '', label: 'none' },
  ...values.map((value) => ({ value, label: value })),
];

/** A tagged value whose values are listed: the others are free text. */
export type ListedTag = { name: string; values: readonly string[] };

/**
 * What a profile declares on one kind: the stereotypes it may carry and the
 * tagged values besides the default ones.
 */
export type KindProfile = {
  stereotypes?: readonly string[];
  tags?: readonly (string | ListedTag)[];
};

/** A grouper: the kinds one declaration is made on. */
export const grouper = (
  kinds: readonly ElementKind[],
  profile: KindProfile,
): Partial<Record<ElementKind, KindProfile>> =>
  Object.fromEntries(kinds.map((kind) => [kind, profile]));

const tagValue = (tags: readonly (string | ListedTag)[]) => {
  const listed = tags.filter(
    (tag): tag is ListedTag => typeof tag !== 'string',
  );
  // the schema's conditional value has one condition: one listed tag per kind
  if (listed.length > 1) throw new Error('one listed tagged value per kind');
  const text: ValueConfig = { type: 'text' };
  const [tag] = listed;
  return tag
    ? ({
        when: { key: 'tag', equals: tag.name },
        matching: { type: 'enum', options: options(tag.values) },
        otherwise: text,
      } satisfies ConditionalValue)
    : text;
};

/** The properties a kind's profile adds, and the annotations writing them. */
const profileOf = (profile: KindProfile) => {
  const tags = [...DEFAULT_TAGS, ...(profile.tags ?? [])];
  const stereotypes = profile.stereotypes ?? [];
  const properties: PropertyDefinition[] = [
    ...(stereotypes.length
      ? [
          {
            key: 'stereotype',
            value: { type: 'enum', options: options(stereotypes) },
            help: 'its stereotype, written <<stereotype>> before it',
          } as const,
        ]
      : []),
    {
      key: 'tag',
      value: {
        type: 'enum',
        options: options(
          tags.map((tag) => (typeof tag === 'string' ? tag : tag.name)),
        ),
      },
      help: 'its tagged value, written {tag = value} before it',
    },
    {
      key: 'tagValue',
      value: tagValue(tags),
      help: 'the tagged value’s value',
    },
  ];
  const annotations: DeclarationDefinition[] = [
    ...(stereotypes.length ? [stereotypeAnnotation] : []),
    taggedValueAnnotation,
  ];
  return { properties, annotations };
};

/**
 * A definition with a profile: each kind the profile names gets its
 * properties and annotations (on top of what the base has).
 */
export const withProfile = (
  base: EngineDefinition,
  id: string,
  name: string,
  profiles: Partial<Record<ElementKind, KindProfile>>,
) => {
  const elements: Record<string, unknown> = { ...base.elements };
  const properties: Record<string, readonly PropertyDefinition[]> = {
    ...base.properties,
  };
  for (const [kind, profile] of Object.entries(profiles)) {
    const element = base.elements[kind as ElementKind];
    if (!element || !profile) continue;
    const added = profileOf(profile);
    elements[kind] = { ...element, annotations: added.annotations };
    properties[kind] = [
      ...base.properties[kind as ElementKind],
      ...added.properties,
    ];
  }
  return defineEngine({
    ...base,
    id,
    name,
    elements,
    properties,
  } as EngineDefinition);
};

/** Every element an Edge model draws (piStar-ext's defaults apply to all). */
const INTENTIONAL: ElementKind[] = ['goal', 'task', 'resource'];

/**
 * iStar4RationalAgents over EdgeV2: what the schema expresses of it. The
 * rational grouper (Actor, Role) and its stereotypes simple-reflex,
 * model-based reflex, goal-based and utility-based are not expressible:
 * actors are not element kinds; nor are Planning and Plan.
 */
export const istar4RationalAgents = withProfile(
  edgeV2,
  'edgeV2.istar4RationalAgents',
  'EdgeV2 + iStar4RationalAgents',
  {
    ...grouper(INTENTIONAL, {}),
    task: {
      // an agent's action (the paper's [14])
      stereotypes: ['action'],
      // duty: a mandatory task; right: an optional one
      tags: [{ name: 'type', values: ['duty', 'right'] }],
    },
  },
);

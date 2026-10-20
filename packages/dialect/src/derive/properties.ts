import {
  isExtensionKind,
  referencedKinds,
  type ActorPropertyDefinition,
  type AnyDialect,
  type Condition,
  type ConditionalValue,
  type PropertyDefinition,
  type ValueConfig,
} from '../schema';

export type Properties = Readonly<Record<string, string | undefined>>;

type WithProperties = {
  properties: Readonly<Record<string, readonly { key: string }[]>>;
};

/** The keys a definition reads for a kind, in its order (literal types kept). */
export const propertyKeys = <
  D extends WithProperties,
  K extends keyof D['properties'] & string,
>(
  definition: D,
  kind: K,
): readonly D['properties'][K][number]['key'][] =>
  definition.properties[kind]!.map(
    (p) => p.key,
  ) as D['properties'][K][number]['key'][];

/**
 * Whether a property reads as a value (a condition's `when`): its text
 * trimmed, as an enum reads it (goal-controller#234: `' int'` is `int`).
 */
const reads = (
  properties: Properties,
  when: { key: string; equals: string },
): boolean => properties[when.key]?.trim() === when.equals;

export const evaluateCondition = (
  condition: Condition | undefined,
  properties: Properties,
  fallback: boolean,
): boolean => {
  if (condition === undefined) return fallback;
  if (condition === 'always') return true;
  if ('not' in condition) return !reads(properties, condition.not.when);
  return reads(properties, condition.when);
};

const isConditional = (
  value: ValueConfig | ConditionalValue,
): value is ConditionalValue => 'when' in value;

/** A property's value config, given the element's other properties. */
export const valueOf = (
  property: Pick<PropertyDefinition, 'value'>,
  properties: Properties,
): ValueConfig =>
  isConditional(property.value)
    ? reads(properties, property.value.when)
      ? property.value.matching
      : property.value.otherwise
    : property.value;

/** A message template: `{key}` is that property's value, or `unset`. */
export const fillTemplate = (
  template: string,
  properties: Properties,
): string =>
  template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => properties[key] ?? 'unset',
  );

/**
 * A keyed property's key on disk, read (goal-controller#190, D2):
 * `Probability[e1]` is `Probability` keyed by `e1`; null for any other key.
 */
export const keyedKeyOf = (
  key: string,
): { key: string; name: string } | null => {
  const read = /^([A-Za-z][A-Za-z0-9_]*)\[\s*([^\]\s]+)\s*\]$/.exec(key);
  return read ? { key: read[1]!, name: read[2]! } : null;
};

/** A keyed property's key on disk for a name: `Probability[e1]`. */
export const keyedKey = (key: string, name: string): string =>
  `${key}[${name}]`;

/**
 * The property a kind's key is: its own, or (`Probability[e1]`) the keyed
 * property it is one name's value of.
 */
export const propertyOf = (
  definition: Pick<AnyDialect, 'properties'>,
  kind: string,
  key: string,
): PropertyDefinition | undefined => {
  const list = definition.properties[kind];
  const own = list?.find((p) => p.key === key);
  if (own || !list) return own;
  const keyed = keyedKeyOf(key);
  return keyed
    ? list.find((p) => p.key === keyed.key && p.keyed !== undefined)
    : undefined;
};

/** The keys a definition reads on actors (goal-controller#125), literal types kept. */
export const actorPropertyKeys = <
  D extends { actors?: readonly { key: string }[] },
>(
  definition: D,
): readonly NonNullable<D['actors']>[number]['key'][] =>
  [...new Set((definition.actors ?? []).map((p) => p.key))] as NonNullable<
    D['actors']
  >[number]['key'][];

/** The keys a definition reads on links, every kind's, literal types kept. */
export const linkPropertyKeys = <
  D extends { links?: Readonly<Record<string, readonly { key: string }[]>> },
>(
  definition: D,
): readonly NonNullable<D['links']>[keyof NonNullable<
  D['links']
>][number]['key'][] =>
  [
    ...new Set(
      Object.values(definition.links ?? {}).flatMap((list) =>
        list.map((p) => p.key),
      ),
    ),
  ] as NonNullable<D['links']>[keyof NonNullable<D['links']>][number]['key'][];

/** The properties a link of this kind has (goal-controller#107; none: `[]`). */
export const linkPropertiesOf = (
  definition: Pick<AnyDialect, 'links'>,
  linkKind: string,
): readonly PropertyDefinition[] => definition.links?.[linkKind] ?? [];

/** The properties an actor of this kind has: those with no `kinds`, or naming it. */
export const actorPropertiesOf = (
  definition: Pick<AnyDialect, 'actors'>,
  actorKind: string,
): readonly ActorPropertyDefinition[] =>
  (definition.actors ?? []).filter(
    (property) => !property.kinds || property.kinds.includes(actorKind),
  );

/** The fill a kind is drawn with when no colour is saved. */
export const fillOf = (
  definition: Pick<AnyDialect, 'elements' | 'defaultFill'>,
  kind: string,
): string =>
  (definition.elements as AnyDialect['elements'])[kind]?.fill ??
  definition.defaultFill;

/** A property's value configs: its own, or both a conditional one's. */
const configsOf = (
  property: Pick<PropertyDefinition, 'value'>,
): ValueConfig[] =>
  isConditional(property.value)
    ? [property.value.matching, property.value.otherwise]
    : [property.value];

/**
 * The extension's kinds a definition reads (goal-controller#132): those it
 * lists, gives properties, or names in a reference (an operand, an
 * assertion's or expression's `resolves`, a refList's `kind`). What a view
 * of a model holds besides iStar's kinds.
 */
export const extensionKindsRead = (
  definition: Partial<
    Pick<
      AnyDialect,
      'elements' | 'properties' | 'notation' | 'links' | 'actors'
    >
  >,
): string[] => {
  const lists = [
    ...Object.values(definition.properties ?? {}),
    ...Object.values(definition.links ?? {}),
    definition.actors ?? [],
  ];
  const kinds = [
    ...Object.keys(definition.elements ?? {}),
    ...Object.keys(definition.properties ?? {}),
    ...(definition.notation?.operand.kinds ?? []),
    ...lists.flatMap((list) =>
      list.flatMap((property) => configsOf(property).flatMap(referencedKinds)),
    ),
  ];
  return [...new Set(kinds.filter(isExtensionKind))];
};

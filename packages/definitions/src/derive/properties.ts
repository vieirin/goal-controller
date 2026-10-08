import type {
  Condition,
  ConditionalValue,
  ElementKind,
  EngineDefinition,
  PropertyDefinition,
  PropertyKeyOf,
  ValueConfig,
} from '../schema';

export type Properties = Readonly<Record<string, string | undefined>>;

type WithProperties = {
  properties: Readonly<Record<ElementKind, readonly { key: string }[]>>;
};

/** The keys a definition reads for a kind, in its order (literal types kept). */
export const propertyKeys = <D extends WithProperties, K extends ElementKind>(
  definition: D,
  kind: K,
): readonly PropertyKeyOf<D, K>[] =>
  definition.properties[kind].map((p) => p.key) as PropertyKeyOf<D, K>[];

export const evaluateCondition = (
  condition: Condition | undefined,
  properties: Properties,
  fallback: boolean,
): boolean => {
  if (condition === undefined) return fallback;
  if (condition === 'always') return true;
  if ('not' in condition)
    return properties[condition.not.when.key] !== condition.not.when.equals;
  return properties[condition.when.key] === condition.when.equals;
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
    ? properties[property.value.when.key] === property.value.when.equals
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

export const propertyOf = (
  definition: Pick<EngineDefinition, 'properties'>,
  kind: ElementKind,
  key: string,
): PropertyDefinition | undefined =>
  definition.properties[kind].find((p) => p.key === key);

/** The fill a kind is drawn with when no colour is saved. */
export const fillOf = (
  definition: Pick<EngineDefinition, 'elements' | 'defaultFill'>,
  kind: ElementKind,
): string =>
  (definition.elements as EngineDefinition['elements'])[kind]?.fill ??
  definition.defaultFill;

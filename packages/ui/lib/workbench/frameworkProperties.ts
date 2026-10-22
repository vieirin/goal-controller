/**
 * istar-ts's property schema for a kind's properties a dialect gives it
 * (goal-controller#327): the diagram's inspector (`IstarInspector`) only
 * types the properties istar-ts's own extensions declare (KAOS's
 * `KAOS_PROPERTY_SCHEMAS`), so a dialect's own (nfrprop's `initialLabel`)
 * are typed here instead, from its `PropertyDefinition`s. Only the value
 * types istar-ts's inspector has a field for: `enum` (a select; `''` stays
 * "unset"), `int`/`number` (a number input), `bool` (a checkbox) and `text`
 * (a text field), and a `distribution` as its text (goal-controller#190).
 * Any other value type (a `reference`, an `assertion`, …) is left out: it
 * stays a property line in the Notation view only. A keyed property
 * (goal-controller#190 D2, #354) has a field per name of its target: one
 * keyed by a project resource (kaosexpert's `Probability`, by expert) a
 * field per entry the project's resources list (`Probability[e1]`,
 * `ResourceEntries`), in its kind's schema; one keyed by names the model
 * writes or by elements (kaossim's `QualityVariable[ResponseTime]`,
 * goal-controller#376) a field per name the item has (`itemKeyedShape`),
 * which its inspector adds to the schema (KeyedInspector.tsx).
 */
import {
  defineProperties,
  prop,
  type PropertySchema,
  type PropertyShape,
  type PropertyType,
} from '@istar-ts/core';
import {
  keyedKey,
  type AnyDialect,
  type PropertyDefinition,
  type ResourceEntry,
} from '@goal-controller/dialect';
import { keyedKeyOf } from '@goal-controller/goal-language';

/** The project's resources' entries, by resource kind (kaosexpert's experts): what a property keyed by one has a field per. */
export type ResourceEntries = Readonly<
  Record<string, readonly ResourceEntry[]>
>;

/** A property's istar-ts type, or none for a value type istar-ts has no field for. */
const typeOf = (
  property: PropertyDefinition,
): PropertyType<unknown> | undefined => {
  const { value } = property;
  if ('when' in value) return undefined;
  switch (value.type) {
    case 'enum':
      return prop.enum(
        value.options.map((option) => option.value).filter((v) => v !== ''),
        { optional: true },
      );
    case 'int':
      return prop.number({
        integer: true,
        min: value.min,
        max: value.max,
        optional: true,
      });
    case 'number':
      return prop.number({ min: value.min, max: value.max, optional: true });
    case 'bool':
      return prop.boolean({ optional: true });
    case 'text':
    case 'distribution':
      return prop.string({ optional: true });
    default:
      return undefined;
  }
};

/** A list's properties, as an istar-ts shape (those with a typed field only). */
const shapeOf = (
  properties: readonly PropertyDefinition[] | undefined,
  entries: ResourceEntries = {},
): PropertyShape => {
  const shape: Record<string, PropertyType<unknown>> = {};
  for (const property of properties ?? []) {
    const type = typeOf(property);
    if (!type) continue;
    shape[property.key] = type;
    // keyed by a resource: a field per entry; by names an item has, its
    // inspector's (itemKeyedShape)
    if (property.keyed && 'resource' in property.keyed)
      for (const entry of entries[property.keyed.resource] ?? [])
        shape[keyedKey(property.key, entry.id)] = type;
  }
  return shape;
};

/**
 * A list's properties keyed by names an item has (goal-controller#376):
 * by names the model writes, or by elements, with a typed field. Their
 * names are each item's own, so its inspector adds their fields.
 */
export const itemKeyedProperties = (
  properties: readonly PropertyDefinition[] | undefined,
): PropertyDefinition[] =>
  (properties ?? []).filter(
    (property) =>
      property.keyed && !('resource' in property.keyed) && typeOf(property),
  );

/**
 * An item's fields for its properties keyed by names it has
 * (`itemKeyedProperties`): one per keyed key it stores
 * (`QualityVariable[ResponseTime]`), in the order stored.
 */
export const itemKeyedShape = (
  properties: readonly PropertyDefinition[] | undefined,
  stored: Readonly<Record<string, unknown>> | undefined,
): PropertyShape => {
  const keyed = new Map(
    itemKeyedProperties(properties).map((property) => [
      property.key,
      typeOf(property),
    ]),
  );
  const shape: Record<string, PropertyType<unknown>> = {};
  for (const key of Object.keys(stored ?? {})) {
    const type = keyed.get(keyedKeyOf(key)?.key ?? '');
    if (type) shape[key] = type;
  }
  return shape;
};

/** A kind's element properties, typed for istar-ts's inspector; none without any. */
export const schemaOf = (
  definition: Pick<AnyDialect, 'properties'>,
  kind: string,
  entries?: ResourceEntries,
): PropertySchema<PropertyShape, string> | undefined => {
  const shape = shapeOf(definition.properties[kind], entries);
  return Object.keys(shape).length
    ? defineProperties<PropertyShape, string>(kind, shape)
    : undefined;
};

/** The same, for a link kind's properties (`links`). */
export const linkSchemaOf = (
  definition: Pick<AnyDialect, 'links'>,
  kind: string,
): PropertySchema<PropertyShape, string> | undefined => {
  const shape = shapeOf(definition.links?.[kind]);
  return Object.keys(shape).length
    ? defineProperties<PropertyShape, string>(kind, shape)
    : undefined;
};

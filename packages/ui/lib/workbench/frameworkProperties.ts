/**
 * istar-ts's property schema for a kind's properties a dialect gives it
 * (goal-controller#327): the diagram's inspector (`IstarInspector`) only
 * types the properties istar-ts's own extensions declare (KAOS's
 * `KAOS_PROPERTY_SCHEMAS`), so a dialect's own (nfrprop's `initialLabel`)
 * are typed here instead, from its `PropertyDefinition`s. Only the value
 * types istar-ts's inspector has a field for: `enum` (a select; `''` stays
 * "unset"), `int`/`number` (a number input), `bool` (a checkbox) and `text`
 * (a text field). Any other value type (a `reference`, an `assertion`, …)
 * is left out: it stays a property line in the Notation view only.
 */
import {
  defineProperties,
  prop,
  type PropertySchema,
  type PropertyShape,
  type PropertyType,
} from '@istar-ts/core';
import type { AnyDialect, PropertyDefinition } from '@goal-controller/dialect';

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
      return prop.string({ optional: true });
    default:
      return undefined;
  }
};

/** A list's properties, as an istar-ts shape (those with a typed field only). */
const shapeOf = (
  properties: readonly PropertyDefinition[] | undefined,
): PropertyShape => {
  const shape: Record<string, PropertyType<unknown>> = {};
  for (const property of properties ?? []) {
    const type = typeOf(property);
    if (type) shape[property.key] = type;
  }
  return shape;
};

/** A kind's element properties, typed for istar-ts's inspector; none without any. */
export const schemaOf = (
  definition: Pick<AnyDialect, 'properties'>,
  kind: string,
): PropertySchema<PropertyShape, string> | undefined => {
  const shape = shapeOf(definition.properties[kind]);
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

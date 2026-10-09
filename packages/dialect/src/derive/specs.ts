/**
 * The inspector's property specs, from a definition: the input each property
 * is edited with, whether it applies given the element's other properties,
 * whether it is needed, and the engine check rejecting a bad value (bound by
 * name from the engine library's check registry, whatever its check type).
 */
import type { AnyDialect, PropertyDefinition, ValueConfig } from '../schema';
import {
  evaluateCondition,
  fillTemplate,
  valueOf,
  type Properties,
} from './properties';

export type PropertyInput =
  | { kind: 'text'; placeholder?: string }
  | { kind: 'long'; placeholder?: string }
  | { kind: 'integer'; min?: number }
  | { kind: 'number' }
  /** `''` stands for "not set" (the property is removed) */
  | {
      kind: 'select';
      options: ReadonlyArray<{ value: string; label: string }>;
    };

/** `C`: the engine library's check function type (the definition only names checks). */
export type PropertySpec<K extends string = string, C = unknown> = {
  key: K;
  /** how to edit it; may depend on the other properties */
  input: PropertyInput | ((properties: Properties) => PropertyInput);
  /** whether the engine reads it, given the other properties (default: always) */
  applies?: (properties: Properties) => boolean;
  /** why it does not apply, for a value that is set anyway */
  notApplying?: (properties: Properties) => string;
  /** shown as a row even when unset (the engine needs it) */
  required?: (properties: Properties) => boolean;
  /** what the engine would reject in a value: its check, bound by name */
  validate?: C;
};

const BOOL_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
];

/** The input a value config is edited with. */
export const inputFor = (
  value: ValueConfig,
  placeholder: string | undefined,
): PropertyInput => {
  const withPlaceholder = <T extends object>(input: T) =>
    placeholder === undefined ? input : { ...input, placeholder };
  switch (value.type) {
    case 'enum':
      return { kind: 'select', options: value.options };
    case 'bool':
      return { kind: 'select', options: BOOL_OPTIONS };
    case 'int':
      return value.min === undefined
        ? { kind: 'integer' }
        : { kind: 'integer', min: value.min };
    case 'number':
      return { kind: 'number' };
    case 'assertion':
      return withPlaceholder({ kind: 'long' as const });
    case 'text':
    case 'refList':
    case 'pairList':
    case 'annotatedName':
      return withPlaceholder({ kind: 'text' as const });
  }
};

export const inputOf = (
  spec: Pick<PropertySpec, 'input'>,
  properties: Properties,
): PropertyInput =>
  typeof spec.input === 'function' ? spec.input(properties) : spec.input;

/** The inspector specs per kind; throws if a check is not in the registry. */
export const specsFromDefinition = <K extends string, C>(
  definition: Pick<AnyDialect, 'id'> & {
    properties: Readonly<Record<K, readonly PropertyDefinition[]>>;
  },
  registry: Readonly<Record<string, C>>,
): Record<K, PropertySpec<string, C>[]> => {
  const specs = (kind: K): PropertySpec<string, C>[] =>
    definition.properties[kind]
      .filter((property) => property.inspector !== false)
      .map((property) => {
        const placeholder = property.input?.placeholder;
        const spec: PropertySpec<string, C> = {
          key: property.key,
          input:
            'when' in property.value
              ? (p) => inputFor(valueOf(property, p), placeholder)
              : inputFor(property.value, placeholder),
        };
        const { applies, required, notApplying, check } = property;
        if (applies !== undefined)
          spec.applies = (p) => evaluateCondition(applies, p, true);
        if (required !== undefined)
          spec.required = (p) => evaluateCondition(required, p, false);
        if (notApplying !== undefined)
          spec.notApplying = (p) => fillTemplate(notApplying, p);
        if (check !== undefined) {
          const validate = registry[check];
          if (!validate)
            throw new Error(`${definition.id}: no check named ${check}`);
          spec.validate = validate;
        }
        return spec;
      });
  return Object.fromEntries(
    (Object.keys(definition.properties) as K[]).map((kind) => [
      kind,
      specs(kind),
    ]),
  ) as Record<K, PropertySpec<string, C>[]>;
};

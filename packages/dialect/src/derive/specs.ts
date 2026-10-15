/**
 * The inspector's property specs, from a definition: the input each property
 * is edited with, whether it applies given the element's other properties,
 * whether it is needed, and the engine check rejecting a bad value (bound by
 * name from the engine library's check registry, whatever its check type).
 */
import type {
  AnyDialect,
  CheckNameOf,
  PropertyDefinition,
  ValueConfig,
} from '../schema';
import {
  actorPropertiesOf,
  evaluateCondition,
  fillTemplate,
  linkPropertiesOf,
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
    case 'expression':
    case 'ocl':
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

/** The specs of a list of properties (an element kind's, a link kind's, the actors'). */
const specsOfList = <C>(
  id: string,
  list: readonly PropertyDefinition[],
  registry: Readonly<Record<string, C | undefined>>,
): PropertySpec<string, C>[] =>
  list
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
        // the type requires it: an untyped definition (AnyDialect) may still miss it
        const validate = registry[check];
        if (!validate) throw new Error(`${id}: no check named ${check}`);
        spec.validate = validate;
      }
      return spec;
    });

/** The inspector specs per kind; throws if a check is not in the registry. */
export const specsFromDefinition = <
  D extends Pick<AnyDialect, 'id'> & {
    properties: Readonly<Record<string, readonly PropertyDefinition[]>>;
  },
  R extends Readonly<Record<CheckNameOf<D>, unknown>>,
>(
  definition: D,
  /** a check for every name the definition's properties give (a missing one doesn't compile) */
  registry: R,
): Record<
  keyof D['properties'] & string,
  PropertySpec<string, R[keyof R]>[]
> => {
  type K = keyof D['properties'] & string;
  type C = R[keyof R];
  return Object.fromEntries(
    (Object.keys(definition.properties) as K[]).map((kind) => [
      kind,
      specsOfList<C>(
        definition.id,
        definition.properties[kind]!,
        registry as Readonly<Record<string, C | undefined>>,
      ),
    ]),
  ) as Record<K, PropertySpec<string, C>[]>;
};

/** The inspector specs per link kind (goal-controller#107); none: links have no properties. */
export const linkSpecsFromDefinition = <C>(
  definition: Pick<AnyDialect, 'id' | 'links'>,
  registry: Readonly<Record<string, C | undefined>>,
): Record<string, PropertySpec<string, C>[]> =>
  Object.fromEntries(
    Object.entries(definition.links ?? {}).map(([kind, list]) => [
      kind,
      specsOfList<C>(definition.id, list, registry),
    ]),
  );

/** The inspector specs of a link of this kind (goal-controller#107); none: its kind has no properties. */
export const linkSpecsOfKind = <C>(
  definition: Pick<AnyDialect, 'id' | 'links'>,
  registry: Readonly<Record<string, C | undefined>>,
  kind: string,
): PropertySpec<string, C>[] =>
  specsOfList<C>(definition.id, linkPropertiesOf(definition, kind), registry);

/** The inspector specs of an actor of this kind (goal-controller#107): the actors' properties its kind has. */
export const actorSpecsFromDefinition = <C>(
  definition: Pick<AnyDialect, 'id' | 'actors'>,
  registry: Readonly<Record<string, C | undefined>>,
  kind: string,
): PropertySpec<string, C>[] =>
  specsOfList<C>(definition.id, actorPropertiesOf(definition, kind), registry);

/**
 * A whole property record read against a dialect (goal-controller#187): an
 * element's, an actor's or a link's stored strings, each read as its
 * property's value type into the goal language's data for it, typed by the
 * dialect. What an engine maps from: it never parses a value's text itself.
 */
import {
  refListKinds,
  valueParts,
  actorPropertiesOf,
  enumOptionOf,
  linkPropertiesOf,
  probabilityOf,
  distributionOf,
  keyedKeyOf,
  type Distribution,
  valueOf,
  type ConditionalValue,
  type PropertyDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';
import {
  asPairList,
  type Assertion,
  type Pair,
  type PairList,
} from '../members.js';
import { parseValue, type ValueData } from '../parse.js';

/**
 * What a value config reads into: `ValueData` for its type, an enum narrowed
 * to its options' values (when the config keeps their literal types; any
 * word when it is `open`). A dialect's types the goal language has no rule
 * for: a `reference` is the id written, a `formula` its text, a
 * `probability` its number in [0, 1]. Null: empty.
 */
export type ValueDataOf<C> = C extends { type: 'enum'; open: true }
  ? string | null
  : C extends { type: 'enum'; options: readonly (infer O)[] }
    ?
        | (O extends { value: infer V extends string } ? Exclude<V, ''> : never)
        | null
    : C extends { type: 'assertion'; separator: string }
      ? Assertion[]
      : C extends { type: 'pairList'; value: infer V }
        ? PairList<V extends 'text' ? string : number>
        : C extends { type: 'reference' | 'formula' }
          ? string | null
          : C extends { type: 'probability' }
            ? number | null
            : C extends { type: 'distribution' }
              ? Distribution | null
              : C extends { type: infer T extends keyof ValueData }
                ? ValueData[T]
                : never;

/** What a property reads into: a conditional one's, either of its configs'. */
export type PropertyDataOf<V> = V extends ConditionalValue
  ? ValueDataOf<V['matching']> | ValueDataOf<V['otherwise']>
  : ValueDataOf<V>;

/** Properties as a dialect lists them (only their keys and values are read here). */
export type PropertyList = readonly (Pick<PropertyDefinition, 'key' | 'value'> &
  Partial<Pick<PropertyDefinition, 'keyed'>>)[];

/**
 * A record's values, typed by its properties: each key's data
 * (`PropertyDataOf`). Unset, or written with a parse error: absent.
 */
export type PropertyValues<L extends PropertyList> = {
  [K in L[number]['key']]?: PropertyDataOf<
    Extract<L[number], { key: K }>['value']
  >;
};

/** A record's values as written, by its properties' keys. */
export type PropertyTexts<L extends PropertyList> = {
  [K in L[number]['key']]?: string;
};

/** The properties a dialect gives an element kind (none: `[]`). */
export type ElementPropertiesOf<D, K> = D extends {
  properties: infer P;
}
  ? K extends keyof P
    ? P[K] extends PropertyList
      ? P[K]
      : []
    : []
  : [];

/** The properties a dialect gives actors (every actor kind's). */
export type ActorPropertiesOf<D> = D extends { actors?: infer A }
  ? NonNullable<A> extends PropertyList
    ? NonNullable<A>
    : []
  : [];

/** The properties a dialect gives a link kind (none: `[]`). */
export type LinkPropertiesOf<D, K> = D extends { links?: infer L }
  ? K extends keyof NonNullable<L>
    ? NonNullable<L>[K] extends PropertyList
      ? NonNullable<L>[K]
      : []
    : []
  : [];

/** What `readProperties` reads: an element's, an actor's or a link's record, by its kind. */
export type PropertyOwner =
  | { element: string }
  | { actor: string }
  | { link: string };

/** The properties of what `readProperties` reads, by its owner. */
export type OwnerPropertiesOf<D, O> = O extends { element: infer K }
  ? ElementPropertiesOf<D, K>
  : O extends { actor: string }
    ? ActorPropertiesOf<D>
    : O extends { link: infer K }
      ? LinkPropertiesOf<D, K>
      : [];

/** A dialect as `readProperties` reads it: its element kinds', actors' and link kinds' properties. */
export type PropertyDialect = {
  properties?: Readonly<Record<string, PropertyList>>;
  actors?: readonly (PropertyList[number] & {
    kinds?: readonly string[];
  })[];
  links?: Readonly<Record<string, PropertyList>>;
};

/** A record read: its typed values, and its texts as written. */
export type PropertyRecord<L extends PropertyList> = {
  values: PropertyValues<L>;
  text: PropertyTexts<L>;
};

/** One value's data, or undefined when its text doesn't read as its config. */
/**
 * What a record's references resolve against (goal-controller#243): the
 * kind of the element an id names (its RT id, or its piStar id), as the
 * dialect names kinds (`goal`, `kaos.Softgoal`); undefined for no element.
 */
export type ReadingContext = { kindOf(id: string): string | undefined };

const readValue = (
  config: ValueConfig,
  text: string,
  context?: ReadingContext,
): unknown => {
  switch (config.type) {
    case 'reference': {
      const id = text.trim();
      if (!id || !context) return id || null;
      // an id of no element, or of a kind it doesn't name, isn't its type,
      // as valueProblem reports
      const kind = context.kindOf(id);
      return kind !== undefined &&
        (config.kinds as readonly string[]).includes(kind)
        ? id
        : undefined;
    }
    case 'formula':
      return text.trim() || null;
    case 'probability': {
      if (!text.trim()) return null;
      return probabilityOf(text) ?? undefined;
    }
    case 'distribution': {
      if (!text.trim()) return null;
      return distributionOf(text, config) ?? undefined;
    }
    case 'int':
    case 'number': {
      const read = parseValue(config.type, text);
      if (read.errors.length) return undefined;
      // outside its bounds it isn't its type, as valueProblem reports
      // (goal-controller#249; number: #236)
      const n = read.value;
      if (n === null) return null;
      if (config.min !== undefined && n < config.min) return undefined;
      if (config.max !== undefined && n > config.max) return undefined;
      return n;
    }
    case 'assertion': {
      if (!config.separator) {
        const read = parseValue('assertion', text);
        return read.errors.length ? undefined : read.value;
      }
      // a list of conditions (goal-controller#232): each part one, or none
      const conditions: Assertion[] = [];
      for (const part of valueParts(config, text)) {
        const read = parseValue('assertion', part.text);
        if (read.errors.length || !read.value) return undefined;
        conditions.push(read.value);
      }
      return conditions;
    }
    case 'refList': {
      const read = parseValue('refList', text);
      if (read.errors.length) return undefined;
      if (!context) return read.value;
      // an id of no element, or of a kind it doesn't name, makes it not
      // its type, as valueProblem reports (goal-controller#270)
      const kinds: readonly string[] = refListKinds(config);
      return read.value.every((id) => {
        const kind = context.kindOf(id);
        return kind !== undefined && kinds.includes(kind);
      })
        ? read.value
        : undefined;
    }
    case 'pairList': {
      const read = parseValue('pairList', text);
      if (read.errors.length) return undefined;
      if (config.value === 'text') return read.value;
      // each member as its value type: one that isn't makes the value
      // unset, as any value written with an error is (goal-controller#235)
      const pairs: Pair<number>[] = [];
      for (const pair of read.value) {
        const value = parseValue(config.value, pair.value);
        if (value.errors.length || value.value === null) return undefined;
        pairs.push({ name: pair.name, value: value.value });
      }
      return asPairList(pairs);
    }
    case 'enum': {
      const read = parseValue('enum', text);
      if (read.errors.length) return undefined;
      if (read.value === null) return null;
      // an option as `options` writes it (in any case, where it is
      // caseInsensitive); a closed enum's value is one, or isn't its type
      const option = enumOptionOf(config, read.value);
      return option ?? (config.open ? read.value : undefined);
    }
    default: {
      const read = parseValue(config.type, text);
      return read.errors.length ? undefined : read.value;
    }
  }
};

/**
 * An element's, an actor's or a link's stored properties read against a
 * dialect, for its kind (`{ element: 'goal' }`, `{ actor: 'istar.Agent' }`,
 * `{ link: 'istar.ContributionLink' }`): only the keys the dialect gives it,
 * each value read as its config (a conditional one's, as the record's other
 * properties make it). A value written with an error is unset in `values`
 * (the dialect's checks report it) and kept in `text`. With a `context`, a
 * `reference` naming no element, or one of a kind it doesn't name, is such
 * a value (goal-controller#243); without, it is the id as written.
 */
export const readProperties = <
  const D extends PropertyDialect,
  const O extends PropertyOwner,
>(
  definition: D,
  owner: O,
  stored: Readonly<Record<string, string | undefined>>,
  context?: ReadingContext,
): PropertyRecord<OwnerPropertiesOf<D, O>> => {
  const list: PropertyList =
    'element' in owner
      ? (definition.properties?.[owner.element] ?? [])
      : 'actor' in owner
        ? actorPropertiesOf({ actors: definition.actors as never }, owner.actor)
        : linkPropertiesOf({ links: definition.links as never }, owner.link);
  const values: Record<string, unknown> = {};
  const text: Record<string, string> = {};
  for (const property of list) {
    // a keyed property's names' values too (`Probability[e1]`,
    // goal-controller#190), each by its key on disk
    const keys = [
      property.key,
      ...(property.keyed === undefined
        ? []
        : Object.keys(stored).filter(
            (key) => keyedKeyOf(key)?.key === property.key,
          )),
    ];
    for (const key of keys) {
      const written = stored[key];
      if (written === undefined || key in text) continue;
      text[key] = written;
      const value = readValue(valueOf(property, stored), written, context);
      if (value !== undefined) values[key] = value;
    }
  }
  return { values, text } as PropertyRecord<OwnerPropertiesOf<D, O>>;
};

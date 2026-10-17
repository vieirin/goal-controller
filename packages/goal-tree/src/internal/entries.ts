/**
 * A mapper by kind (goal-controller#215): an engine declares one entry per
 * kind of its dialect, or per group of kinds that map alike, each saying what
 * the kinds are to it (`as`) and how their properties map (`mapProps`).
 * Every kind of the dialect has an entry or is ignored (a compile error
 * otherwise), and each node's engine properties are its kind's entry's
 * output.
 */
import type { ISTAR_KIND_OF } from '@goal-controller/dialect';
import type {
  ActorPropertiesOf,
  ElementPropertiesOf,
  ExecutionDetailOf,
  LinkPropertiesOf,
  PropertyTexts,
  PropertyValues,
} from '@goal-controller/goal-language';
import type {
  KindModel,
  KindNode,
  KindProps,
  Naming,
  Shape,
} from '../types/kindTree';
import type { MapperDialect, PropsOf } from './engineMapper';

type IstarKindMap = typeof ISTAR_KIND_OF;
type IstarModelKind = IstarKindMap[keyof IstarKindMap];

/** An extension's node kinds (its actor kinds are actors). */
type ExtensionNodeKinds<D> = D extends {
  extension: { elements: readonly (infer E)[] };
}
  ? E extends { category: 'actor' }
    ? never
    : E extends { kind: infer K extends string }
      ? K
      : never
  : never;

type PropertyKindsOf<D> = D extends { properties: infer P }
  ? keyof P & string
  : never;

/**
 * The element kinds a dialect has, which a mapper's entries name: in a KAOS
 * or NFR dialect, those it lists and those it gives properties (KAOS's
 * refinement hub); in an iStar one, iStar's four (a model may hold any),
 * its extension's node kinds, and any namespaced kind it gives properties.
 */
export type ElementKindsOf<D> = D extends { framework: 'kaos' | 'nfr' }
  ?
      | (D extends { elements: infer E } ? keyof E & string : never)
      | PropertyKindsOf<D>
  :
      | IstarModelKind
      | ExtensionNodeKinds<D>
      | Extract<PropertyKindsOf<D>, `${string}.${string}`>;

/** The dialect key a model kind's properties are under (`istar.Goal`: `goal`). */
type PropertyKindOf<K> = K extends IstarModelKind
  ? {
      [I in keyof IstarKindMap & string]: IstarKindMap[I] extends K ? I : never;
    }[keyof IstarKindMap & string]
  : K;

/**
 * What an entry's `mapProps` is given for an element, one member per kind
 * (narrowing on `kind` narrows `props`): its kind's properties (`props`,
 * typed; `raw`, as written), its RT id, its name, its text as written and
 * its execution detail in the dialect (null without notation).
 */
export type ElementInput<D, K> = K extends unknown
  ? PropsOf<ElementPropertiesOf<D, PropertyKindOf<K>>> & {
      kind: K;
      id: string;
      name: string;
      text: string;
      executionDetail: ExecutionDetailOf<D> | null;
    }
  : never;

/** A node as an entry's `afterCreation` is given it. */
export type CreatedNode<K, A, O> = {
  iStarId: string;
  id: string;
  kind: K;
  type: A;
  properties: { root?: boolean; engine: O };
};

/** What an entry's `afterCreation` is given: every node is built. */
export type AfterCreationInput<D, K, A, O> = {
  node: CreatedNode<K, A, O>;
  input: ElementInput<D, K>;
  allNodes: Map<string, KindNode<KindProps, Naming, Shape>>;
  model: KindModel<KindProps, Naming, unknown, unknown, Shape>;
};

/** An entry as the mapper holds it: its kinds, their `as`, its mappers. */
export type Entry<
  K extends string = string,
  A extends string = string,
  O = unknown,
> = {
  kinds: readonly K[];
  as: A;
  mapProps: (input: never) => O;
  afterCreation?: (input: never) => O;
  tree?: false;
};

/** An entry as written: one kind (`kind`) or several (`kinds`). */
type EntryKinds<K> = { kind: K; kinds?: never } | { kinds: readonly K[] };

/** What every entry has besides its kinds and its `as`. */
type EntryBody<D, K, A, O> = {
  mapProps: (input: ElementInput<D, K>) => O;
  /**
   * after every node is built (a dependency resolved by id): the node's
   * final engine properties
   */
  afterCreation?: (
    input: AfterCreationInput<D, K, NoInfer<A>, NoInfer<O>>,
  ) => NoInfer<O>;
  /** held in no tree, only in the model's elements (an own naming's agents, hubs) */
  tree?: false;
};

/**
 * The `entry` an engine writes its entries with: for kinds the naming
 * names, `as` may be left out (it is the naming's, and only the naming's);
 * for the others it is needed. An ignored kind has none.
 */
export type EntryFn<D, N, I> = {
  <const K extends Exclude<ElementKindsOf<D>, I> & keyof N, O>(
    entry: EntryKinds<K> & { as?: N[K] } & EntryBody<D, K, N[K], O>,
  ): Entry<K, N[K] & string, O>;
  <
    const K extends Exclude<ElementKindsOf<D>, I | keyof N>,
    const A extends string,
    O,
  >(
    entry: EntryKinds<K> & { as: A } & EntryBody<D, K, A, O>,
  ): Entry<K, A, O>;
};

type KindsOfEntry<X> = X extends Entry<infer K, string, unknown> ? K : never;
type Covered<E> = E extends readonly (infer X)[] ? KindsOfEntry<X> : never;

/** the entries of E but X (two-way: an entry whose kinds are a subset of X's is another) */
type Others<E extends readonly unknown[], X> = E[number] extends infer Y
  ? Y extends unknown
    ? [Y] extends [X]
      ? [X] extends [Y]
        ? never
        : Y
      : Y
    : never
  : never;

/** the kinds two entries cover */
type Dup<E> = E extends readonly (infer X)[]
  ? X extends unknown
    ? KindsOfEntry<X> & KindsOfEntry<Others<E, X>>
    : never
  : never;

type Missing<D, E, I> = Exclude<ElementKindsOf<D>, Covered<E> | I>;

/**
 * The compile errors of a set of entries: the kinds no entry covers and
 * `ignore` doesn't list, and the kinds two entries cover.
 */
export type EntriesFor<D, E, I> = ([Missing<D, E, I>] extends [never]
  ? unknown
  : { 'kinds without an entry': Missing<D, E, I> }) &
  ([Dup<E>] extends [never] ? unknown : { 'kinds in two entries': Dup<E> });

type EntryOf<E extends readonly Entry[], K> = E[number] extends infer X
  ? X extends Entry<infer XK, string, unknown>
    ? K extends XK
      ? X
      : never
    : never
  : never;

/** The engine's properties by kind: each covered kind's entry's output. */
export type PropsByKind<E extends readonly Entry[]> = {
  [K in Covered<E>]: EntryOf<E, K> extends Entry<string, string, infer O>
    ? O
    : never;
};

/** The engine's naming: each covered kind's `as`. */
export type NamingOf<E extends readonly Entry[]> = {
  [K in Covered<E>]: EntryOf<E, K>['as'];
};

// ── links ──────────────────────────────────────────────────────────────────

/** The link kinds a dialect gives properties: each needs an entry. */
export type LinkKindsOf<D> = D extends { links?: infer L }
  ? keyof NonNullable<L> & string
  : never;

/** What a link entry's `mapProps` is given, one member per kind. */
export type LinkInput<D, K> = K extends unknown
  ? PropsOf<LinkPropertiesOf<D, K>> & { kind: K; id: string }
  : never;

/** A link entry as the mapper holds it. */
export type LinkEntry<K extends string = string, O = unknown> = {
  kinds: readonly K[];
  mapProps: (input: never) => O;
};

/** The `entry` an engine writes its link entries with. */
export type LinkEntryFn<D> = <const K extends LinkKindsOf<D>, O>(
  entry: EntryKinds<K> & { mapProps: (input: LinkInput<D, K>) => O },
) => LinkEntry<K, O>;

/** the link kinds the entries cover (none for `[]`, #259) */
type CoveredLinks<LE extends readonly unknown[]> = LE[number] extends infer X
  ? X extends LinkEntry<infer K, unknown>
    ? K
    : never
  : never;
type LinkMissing<D, LE> = Exclude<
  LinkKindsOf<D>,
  LE extends readonly unknown[] ? CoveredLinks<LE> : never
>;

/** The compile error of a set of link entries: the link kinds with properties none covers. */
export type LinkEntriesFor<D, LE> = [LinkMissing<D, LE>] extends [never]
  ? unknown
  : { 'link kinds without an entry': LinkMissing<D, LE> };

/** What a mapper's links map to: its link entries' outputs. */
export type LinkPropsOf<LE> = LE extends readonly LinkEntry<string, infer O>[]
  ? [O] extends [never]
    ? {}
    : O
  : {};

// ── the naming ─────────────────────────────────────────────────────────────

/** The iStar reading's names: iStar's four kinds as the engines have read them. */
const ISTAR_NAMES = {
  'istar.Goal': 'goal',
  'istar.Quality': 'goal',
  'istar.Task': 'task',
  'istar.Resource': 'resource',
} as const;

/**
 * The iStar reading (goal-controller#215): its names (`istar.Goal` and
 * `istar.Quality` a `goal`, `istar.Task` a `task`, `istar.Resource` a
 * `resource`), and the tree it builds of them (`shape: 'istar'`): a goal
 * holds its goals and tasks, a task its tasks and resources (a NeededBy
 * link's); a resource has no children, only a task has resources, a task
 * no goals; a Quality is no root, nor what only a Quality qualifies; and
 * a goal in an actor that nothing refines is an error unless `leafGoals:
 * 'allow'` (MutRoSe's Query goals).
 */
export const useIstarDefaultNaming = (
  options: { leafGoals?: 'allow' } = {},
) => ({
  names: ISTAR_NAMES,
  shape: 'istar' as const,
  leafGoals: options.leafGoals ?? ('error' as const),
});

/** A naming: its names, the tree shape it reads, its leaf rule. */
export type NamingReading = ReturnType<typeof useIstarDefaultNaming>;

// ── the mapper ─────────────────────────────────────────────────────────────

/** Marks a mapper written with entries, against one written per role. */
export const KIND_MAPPER = Symbol('kind mapper');

/**
 * An engine's mapper by kind: its dialect, its tree shape and leaf rule,
 * its entries (normalized: `kinds` and `as` set), its ignored kinds, its
 * link entries and its actor mapper; `P`, `N`, `A` and `L` are what it
 * maps to (its kinds' properties, its naming, its actors' and its links').
 */
export type KindEngineMapper<
  D = MapperDialect,
  P = KindProps,
  N = Naming,
  A = {},
  L = {},
  S extends Shape = Shape,
> = {
  readonly [KIND_MAPPER]: {
    props: P;
    naming: N;
    actor: A;
    link: L;
  };
  dialect: D;
  shape: S;
  /** whether a goal may be a leaf: always under an own naming */
  allowLeafGoals: boolean;
  elements: readonly Entry[];
  ignore: readonly string[];
  links: readonly LinkEntry[];
  mapActorProps?: (input: never) => A;
};

/** A mapper's engine properties, by kind. */
export type EngineProps<M> =
  M extends KindEngineMapper<any, infer P, any, any, any, any> ? P : never;
/** A mapper's naming. */
export type EngineNaming<M> =
  M extends KindEngineMapper<any, any, infer N, any, any, any> ? N : never;
/** A tree node, as a mapper builds it. */
export type NodeOf<M> =
  M extends KindEngineMapper<any, infer P, infer N, any, any, infer S>
    ? KindNode<P, N, S>
    : never;
/** The IR, as a mapper builds it. */
export type ModelOf<M> =
  M extends KindEngineMapper<any, infer P, infer N, infer A, infer L, infer S>
    ? KindModel<P, N, A, L, S>
    : never;

/** A mapper's configuration, with the iStar reading or an own naming. */
export type KindMapperConfig<D, N, E, I, A> = {
  dialect: D;
  elements: (entry: EntryFn<D, N, I>) => E;
  /** kinds the engine doesn't read: no node, in the model's elements as written */
  ignore?: readonly I[];
  mapActorProps?: (
    input: PropsOf<ActorPropertiesOf<D>> & {
      kind: string;
      id: string;
      name: string;
    },
  ) => A;
};

/**
 * A mapper's link entries, given (`links`, each link kind the dialect gives
 * properties covered) or not (then the dialect gives none). Two overloads
 * of `createEngineMapper`, as an optional callback infers nothing.
 */
export type WithLinks<D, LE> = {
  links: (entry: LinkEntryFn<D>) => LE;
} & LinkEntriesFor<D, LE>;
export type WithoutLinks<D> = { links?: undefined } & ([
  LinkKindsOf<D>,
] extends [never]
  ? unknown
  : { 'link kinds without an entry': LinkKindsOf<D> });

/** Normalizes a written entry: `kinds` from `kind`, `as` from the naming. */
const entryFor =
  (names: Naming) =>
  (written: {
    kind?: string;
    kinds?: readonly string[];
    as?: string;
    mapProps: (input: never) => unknown;
    afterCreation?: (input: never) => unknown;
    tree?: false;
  }): Entry => {
    const kinds = written.kinds ?? [written.kind!];
    const as = written.as ?? names[kinds[0]!];
    if (as === undefined)
      throw new Error(
        `[INVALID MAPPER]: ${kinds.join(', ')}: an entry for a kind the naming doesn't name needs its \`as\``,
      );
    return {
      kinds,
      as,
      mapProps: written.mapProps,
      ...(written.afterCreation && { afterCreation: written.afterCreation }),
      ...(written.tree === false && { tree: false as const }),
    };
  };

const linkEntryFor = (written: {
  kind?: string;
  kinds?: readonly string[];
  mapProps: (input: never) => unknown;
}): LinkEntry => ({
  kinds: written.kinds ?? [written.kind!],
  mapProps: written.mapProps,
});

/** Throws on a kind two entries (or an entry and `ignore`) name. */
const assertOnce = (
  lists: readonly (readonly string[])[],
  what: string,
): void => {
  const seen = new Set<string>();
  for (const kind of lists.flat()) {
    if (seen.has(kind))
      throw new Error(`[INVALID MAPPER]: ${kind} is in two ${what}`);
    seen.add(kind);
  }
};

/** Builds a mapper by kind from its configuration (`createEngineMapper`'s entries form). */
export const kindMapper = (
  config: {
    dialect: MapperDialect;
    naming?: NamingReading;
    elements: (entry: never) => readonly Entry[];
    ignore?: readonly string[];
    links?: (entry: never) => readonly LinkEntry[];
    mapActorProps?: (input: never) => unknown;
  },
  {
    shape = config.naming ? config.naming.shape : 'kinds',
  }: { shape?: 'istar' | 'kinds' } = {},
): KindEngineMapper => {
  const names: Naming = config.naming?.names ?? {};
  const elements = (
    config.elements as unknown as (entry: unknown) => readonly Entry[]
  )(entryFor(names));
  const ignore = config.ignore ?? [];
  assertOnce([...elements.map((entry) => entry.kinds), ignore], 'entries');
  const links = config.links
    ? (config.links as unknown as (entry: unknown) => LinkEntry[])(linkEntryFor)
    : [];
  assertOnce(
    links.map((entry) => entry.kinds),
    'link entries',
  );
  return {
    [KIND_MAPPER]: undefined as never,
    dialect: config.dialect,
    shape,
    allowLeafGoals: shape === 'kinds' || config.naming?.leafGoals === 'allow',
    elements,
    ignore,
    links,
    ...(config.mapActorProps && {
      mapActorProps: config.mapActorProps as (input: never) => {},
    }),
  };
};

/** Whether a mapper is written with entries. */
export const isKindMapper = (mapper: object): mapper is KindEngineMapper =>
  KIND_MAPPER in mapper;

/**
 * Engine Mapper types and factory function
 * Defines how an iStar model's properties, read against the engine's dialect,
 * are mapped to engine-specific properties
 */
import type { AnyDialect, ModelShape } from '@goal-controller/dialect';
import type {
  ActorPropertiesOf,
  LinkPropertiesOf,
  PropertyList,
  PropertyTexts,
  PropertyValues,
} from '@goal-controller/goal-language';
import type { ReadingDialect } from '../parsers/goalNameParser';
import type { Naming, Shape } from '../types/kindTree';
import {
  kindMapper,
  type ElementKindsOf,
  type EntriesFor,
  type Entry,
  type KindEngineMapper,
  type KindMapperConfig,
  type LinkEntry,
  type LinkKindsOf,
  type LinkPropsOf,
  type NamingOf,
  type PropsByKind,
  type WithLinks,
  type WithoutLinks,
} from './entries';

/**
 * The engine's dialect as goal-tree reads it: its goal texts, the model shape
 * it accepts, and its elements (goal-controller#125: in a dialect whose
 * elements have no prefix, no text holds an id); the properties of its
 * element kinds, actors and link kinds, which are the keys a mapper is given
 * (goal-controller#187).
 */
export type MapperDialect = ReadingDialect & {
  model?: ModelShape;
  elements?: AnyDialect['elements'];
  properties?: Readonly<Record<string, PropertyList>>;
  actors?: readonly (PropertyList[number] & { kinds?: readonly string[] })[];
  links?: Readonly<Record<string, PropertyList>>;
} & Partial<
    /** its framework and the link kinds that refine in it (goal-controller#171) */
    Pick<AnyDialect, 'framework' | 'refinements'>
  >;

/**
 * An element's, an actor's or a link's properties as a mapper is given them
 * (goal-controller#187): `props`, each value as the goal language reads its
 * type in the dialect (`int`: a number, `refList`: ids, `assertion`: its
 * tree, an enum one of its options; a conditional one either; written with an
 * error: unset, which the dialect's checks report), and `raw`, the strings
 * as written. Both have only the keys the dialect gives its kind.
 */
export type PropsOf<L extends PropertyList> = {
  props: PropertyValues<L>;
  raw: PropertyTexts<L>;
};

/** What `mapActorProps` is given for an actor (goal-controller#125): its `actors` properties. */
export type ActorPropsInput<TDialect = MapperDialect> = PropsOf<
  ActorPropertiesOf<TDialect>
> & {
  /** `istar.Actor`, `istar.Agent`, `istar.Role` or an extension's actor kind */
  kind: string;
  /** its piStar id */
  id: string;
  name: string;
};

/** What a link entry's `mapProps` is given for a link (goal-controller#125): its kind's `links` properties. */
export type LinkPropsInput<TDialect = MapperDialect> = PropsOf<
  LinkPropertiesOf<
    TDialect,
    keyof NonNullable<TDialect extends { links?: infer L } ? L : never>
  >
> & {
  kind: string;
  /** its piStar id */
  id: string;
};

/**
 * A mapper by kind (goal-controller#215): an entry per kind of the dialect,
 * or per group (`entry({ kinds, as, mapProps })`), every kind covered or in
 * `ignore`. With `naming: useIstarDefaultNaming()`, the iStar reading: `as`
 * is the naming's for iStar's kinds, and the trees are today's (a goal's
 * goals and tasks, a task's tasks and resources); without, every entry
 * names its kinds (`as`), and a node holds every refinement child in
 * `children`. Every link kind the dialect gives properties has an entry in
 * `links`.
 *
 * @example
 * createEngineMapper({
 *   dialect: edgeV2,
 *   naming: useIstarDefaultNaming(),
 *   elements: (entry) => [
 *     entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: ({ props }) => … }),
 *     entry({ kind: 'istar.Task', mapProps: ({ props }) => … }),
 *   ],
 *   ignore: ['istar.Resource'],
 * });
 */
export function createEngineMapper<
  const D extends MapperDialect,
  const E extends readonly Entry<ElementKindsOf<D>>[],
  const LE extends readonly LinkEntry<LinkKindsOf<D>>[],
  const N extends Naming = {},
  const S extends Shape = 'kinds',
  const I extends ElementKindsOf<D> = never,
  A = {},
>(
  config: KindMapperConfig<D, N, E, I, A> & {
    naming?: { names: N; shape: S; leafGoals: 'allow' | 'error' };
  } & EntriesFor<D, E, I> &
    WithLinks<D, LE>,
): KindEngineMapper<D, PropsByKind<E>, NamingOf<E>, A, LinkPropsOf<LE>, S>;
export function createEngineMapper<
  const D extends MapperDialect,
  const E extends readonly Entry<ElementKindsOf<D>>[],
  const N extends Naming = {},
  const S extends Shape = 'kinds',
  const I extends ElementKindsOf<D> = never,
  A = {},
>(
  config: KindMapperConfig<D, N, E, I, A> & {
    naming?: { names: N; shape: S; leafGoals: 'allow' | 'error' };
  } & EntriesFor<D, E, I> &
    WithoutLinks<D>,
): KindEngineMapper<D, PropsByKind<E>, NamingOf<E>, A, {}, S>;
export function createEngineMapper(config: object): unknown {
  return kindMapper(config as Parameters<typeof kindMapper>[0]);
}

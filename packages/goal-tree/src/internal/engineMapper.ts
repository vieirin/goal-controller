/**
 * Engine Mapper types and factory function
 * Defines how an iStar model's properties, read against the engine's dialect,
 * are mapped to engine-specific properties
 */
import type { AnyDialect, ModelShape } from '@goal-controller/dialect';
import type {
  ActorPropertiesOf,
  ElementPropertiesOf,
  ExecutionDetailOf,
  LinkPropertiesOf,
  PropertyList,
  PropertyTexts,
  PropertyValues,
} from '@goal-controller/goal-language';
import type { ReadingDialect } from '../parsers/goalNameParser';
import type { GoalExecutionDetail, GoalModel, TreeNode } from '../types/';
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
 * The dialect kinds a node type's elements are of: iStar's (`goal` and
 * `quality` are goal nodes), or, in a framework's dialect (goal-controller#171),
 * every kind it gives properties (KAOS's goals, domain properties and
 * obstacles are goal nodes; it has no tasks or resources).
 */
type KindsOf<D, T extends 'goal' | 'task' | 'resource'> = D extends {
  framework: 'kaos' | 'nfr';
}
  ? T extends 'goal'
    ? D extends { properties: infer P }
      ? keyof P
      : never
    : never
  : T extends 'goal'
    ? 'goal' | 'quality'
    : T;

/** The properties of a node type's elements, every kind's (`KindsOf`). */
type NodePropertiesOf<
  D,
  T extends 'goal' | 'task' | 'resource',
> = ElementPropertiesOf<D, KindsOf<D, T>>;

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

/** What `mapLinkProps` is given for a link (goal-controller#125): its kind's `links` properties. */
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
 * The actor and link mappers (goal-controller#125), optional: an engine
 * without actor or link properties omits them and gets `{}`.
 */
export type ActorLinkMappers<
  TActorEngine,
  TLinkEngine,
  TDialect = MapperDialect,
> = {
  mapActorProps?: (props: ActorPropsInput<TDialect>) => TActorEngine;
  mapLinkProps?: (props: LinkPropsInput<TDialect>) => TLinkEngine;
};

/**
 * What `mapGoalProps` is given for a goal: its properties (`PropsOf`, its
 * kind's), its execution detail in the engine's dialect, its RT id (G4, …,
 * for error messages the Problems panel can navigate to) and its text as
 * written (`G1: Name [G2;G3]`: an engine that reads more of the notation
 * than its outermost construct, such as nested constructs or calls, reads it
 * with the goal language's `parseElementLine`).
 */
export type GoalPropsInput<
  TDialect = MapperDialect,
  TExecution = ExecutionDetailOf<TDialect>,
> = PropsOf<NodePropertiesOf<TDialect, 'goal'>> & {
  executionDetail: TExecution | null;
  id: string;
  text: string;
  /** its element kind: `istar.Goal`, `istar.Quality`, a framework's (`kaos.Softgoal`, goal-controller#171) */
  kind: string;
};

/** What `mapTaskProps` is given for a task. */
export type TaskPropsInput<TDialect = MapperDialect> = PropsOf<
  NodePropertiesOf<TDialect, 'task'>
> & {
  name: string;
  id: string;
  /** its text as written (`T1.1: Name [W = 0.1]`), for an engine that reads its bracket */
  text: string;
  /** its element kind (`istar.Task`) */
  kind: string;
};

/** What `mapResourceProps` is given for a resource. */
export type ResourcePropsInput<TDialect = MapperDialect> = PropsOf<
  NodePropertiesOf<TDialect, 'resource'>
> & { id: string };

/**
 * A node's properties in afterCreationMapper, discriminated by its node type
 * (`nodeType`, not `type`, which a dialect may name a property), with its
 * element kind.
 */
export type NodePropertiesUnion<TDialect = MapperDialect> =
  | ({ nodeType: 'goal'; kind: string } & PropsOf<
      NodePropertiesOf<TDialect, 'goal'>
    >)
  | ({ nodeType: 'task'; kind: string } & PropsOf<
      NodePropertiesOf<TDialect, 'task'>
    >)
  | ({ nodeType: 'resource'; kind: string } & PropsOf<
      NodePropertiesOf<TDialect, 'resource'>
    >);

/**
 * Resource mapper configuration - discriminated union
 * Either skip resources entirely, or provide a mapper function
 */
type ResourceMapperConfig<TResourceEngine, TDialect> =
  | {
      skipResource: true;
      mapResourceProps?: never;
    }
  | {
      skipResource?: false;
      mapResourceProps: (
        props: ResourcePropsInput<TDialect>,
      ) => TResourceEngine;
    };

/**
 * Engine mapper interface for creating engine-specific properties. The
 * properties each node, actor and link is given are its kind's in
 * `TDialect` (goal-controller#187).
 */
export type EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = unknown,
  TDialect extends MapperDialect = MapperDialect,
  TActorEngine = {},
  TLinkEngine = {},
> = {
  /**
   * the engine's dialect (its definition): goal texts (`G1: Goal [G2;G3]`) are
   * read with the reader goal-tree derives from it, its `model` is the shape
   * the engine accepts (goal-controller#125), and its properties are what
   * the mappers are given
   */
  dialect: TDialect;

  /**
   * Whether a goal may have no children and no tasks (MutRoSe's Query goals).
   * By default such a goal is a model error, as the Edge engines read it.
   */
  allowLeafGoals?: boolean;

  /**
   * Map a goal's properties to engine-specific goal properties: a Quality's
   * too (same mapping path, its kind's properties).
   */
  mapGoalProps: (
    props: GoalPropsInput<TDialect, ExecutionDetailOf<TDialect>>,
  ) => TGoalEngine;

  /**
   * Map raw task properties to engine-specific task properties
   */
  mapTaskProps: (props: TaskPropsInput<TDialect>) => TTaskEngine;

  /**
   * Optional: Transform props after tree is created (e.g., resolve dependsOn)
   * Called for each node after the full tree is built
   * rawProperties is a discriminated union on nodeType: 'goal' | 'task' | 'resource'
   */
  afterCreationMapper?: (props: {
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    rawProperties: NodePropertiesUnion<TDialect>;
    /** the whole IR (goal-controller#125): its actors, links and elements */
    model: GoalModel<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TActorEngine,
      TLinkEngine
    >;
  }) => TGoalEngine | TTaskEngine | TResourceEngine;
} & ResourceMapperConfig<TResourceEngine, TDialect> &
  ActorLinkMappers<TActorEngine, TLinkEngine, TDialect>;

/**
 * Curried helper to create an engine mapper with full type inference.
 * First call provides the engine types (explicit), second call the dialect
 * and the mappers: each is given its kind's properties in that dialect,
 * typed (goal-controller#187).
 *
 * @example
 * const mapper = createEngineMapper<GoalProps, TaskProps, ResourceProps>()({
 *   dialect: edgeV2,
 *   mapGoalProps: ({ props }) => ({ utility: props.utility }), // an expression's tree
 *   mapTaskProps: ({ props }) => ({ retries: props.maxRetries ?? 0 }), // a number
 *   mapResourceProps: ({ raw }) => ({ type: raw.type }), // as written
 * });
 */
export function createEngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = never,
>(): <
  const TDialect extends MapperDialect,
  TActorEngine = {},
  TLinkEngine = {},
>(
  config: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect,
    TActorEngine,
    TLinkEngine
  >,
) => EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TDialect,
  TActorEngine,
  TLinkEngine
>;
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
export function createEngineMapper(config?: object): unknown {
  if (config) return kindMapper(config as Parameters<typeof kindMapper>[0]);
  return (config: EngineMapper<unknown, unknown, unknown>) => {
    if (config.skipResource !== true && !config.mapResourceProps) {
      throw new Error(
        '[INVALID MAPPER]: mapResourceProps is missing. ' +
          'Either provide mapResourceProps or set skipResource: true.',
      );
    }
    const mappers = {
      dialect: config.dialect,
      allowLeafGoals: config.allowLeafGoals,
      mapGoalProps: config.mapGoalProps,
      mapTaskProps: config.mapTaskProps,
      afterCreationMapper: config.afterCreationMapper,
      ...(config.mapActorProps && { mapActorProps: config.mapActorProps }),
      ...(config.mapLinkProps && { mapLinkProps: config.mapLinkProps }),
    };
    return config.skipResource === true
      ? { ...mappers, skipResource: true, mapResourceProps: undefined }
      : { ...mappers, mapResourceProps: config.mapResourceProps };
  };
}

/** A mapper as goal-tree runs it: its inputs any dialect's (they are built from `dialect` at run time). */
export type AnyEngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine = {},
  TLinkEngine = {},
> = {
  dialect: MapperDialect;
  allowLeafGoals?: boolean;
  skipResource?: boolean;
  mapGoalProps: (
    props: GoalPropsInput<MapperDialect, GoalExecutionDetail>,
  ) => TGoalEngine;
  mapTaskProps: (props: TaskPropsInput) => TTaskEngine;
  mapResourceProps?: (props: ResourcePropsInput) => TResourceEngine;
  mapActorProps?: (props: ActorPropsInput) => TActorEngine;
  mapLinkProps?: (props: LinkPropsInput) => TLinkEngine;
  afterCreationMapper?: (props: {
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    rawProperties: NodePropertiesUnion;
    model: GoalModel<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TActorEngine,
      TLinkEngine
    >;
  }) => TGoalEngine | TTaskEngine | TResourceEngine;
};

/** An engine's mapper as goal-tree runs it (its inputs are built from its dialect at run time). */
export const anyMapper = <G, T, R, D extends MapperDialect, A, L>(
  mapper: EngineMapper<G, T, R, D, A, L>,
): AnyEngineMapper<G, T, R, A, L> =>
  mapper as unknown as AnyEngineMapper<G, T, R, A, L>;

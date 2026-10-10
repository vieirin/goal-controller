/**
 * Engine Mapper types and factory function
 * Defines how raw iStar properties are mapped to engine-specific properties
 */
import type { ExecutionDetailOf } from '@goal-controller/goal-language';
import type { ReadingDialect } from '../parsers/goalNameParser';
import type { GoalExecutionDetail, TreeNode } from '../types/';

/**
 * Raw custom properties extracted from the iStar model
 * Generic type that creates a Record of allowed keys to optional string values
 */
export type RawProps<TKeys extends string> = Partial<Record<TKeys, string>>;

/**
 * What `mapGoalProps` is given for a goal: its raw properties, its execution
 * detail in the engine's dialect, its RT id (G4, …, for error messages the
 * Problems panel can navigate to) and its text as written (`G1: Name
 * [G2;G3]`: an engine that reads more of the notation than its outermost
 * construct, such as nested constructs or calls, reads it with the goal
 * language's `parseElementLine`).
 */
export type GoalPropsInput<TKeys extends string, TExecution> = {
  raw: RawProps<TKeys>;
  executionDetail: TExecution | null;
  id: string;
  text: string;
};

/**
 * Discriminated union for raw properties in afterCreationMapper
 * Allows the hook to handle goals, tasks, and resources with type-safe access
 * Uses `nodeType` instead of `type` to avoid conflicts with user-defined `type` properties
 */
export type RawPropertiesUnion<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
> =
  | { nodeType: 'goal'; raw: RawProps<TGoalKeys> }
  | { nodeType: 'task'; raw: RawProps<TTaskKeys> }
  | { nodeType: 'resource'; raw: RawProps<TResourceKeys> };

/**
 * Resource mapper configuration - discriminated union
 * Either skip resources entirely, or provide a mapper function
 */
type ResourceMapperConfig<TResourceEngine, TResourceKeys extends string> =
  | {
      skipResource: true;
      mapResourceProps?: never;
      allowedResourceKeys?: never;
    }
  | {
      skipResource?: false;
      mapResourceProps: (props: {
        raw: RawProps<TResourceKeys>;
        id: string;
      }) => TResourceEngine;
      allowedResourceKeys: readonly TResourceKeys[];
    };

/**
 * Engine mapper interface for creating engine-specific properties
 * TGoalKeys, TTaskKeys, TResourceKeys, TQualityKeys define which custom properties are extracted
 */
export type EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = unknown,
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
  TQualityKeys extends string = never,
> = {
  /**
   * the engine's dialect (its definition): goal texts (`G1: Goal [G2;G3]`) are
   * read with the reader goal-tree derives from it
   */
  dialect: ReadingDialect;

  /**
   * Allowed keys for goal custom properties
   */
  allowedGoalKeys: readonly TGoalKeys[];

  /**
   * Allowed keys for task custom properties
   */
  allowedTaskKeys: readonly TTaskKeys[];

  /**
   * Whether a goal may have no children and no tasks (MutRoSe's Query goals).
   * By default such a goal is a model error, as the Edge engines read it.
   */
  allowLeafGoals?: boolean;

  /**
   * Allowed keys for Quality custom properties. When undeclared, Qualities accept none.
   * Qualities are still mapped as goal nodes (isQuality); only the raw keys differ.
   */
  allowedQualityKeys?: readonly TQualityKeys[];

  /**
   * Map raw goal properties to engine-specific goal properties.
   * Raw may also hold Quality keys when the node is a Quality (same mapping path).
   */
  mapGoalProps: (
    props: GoalPropsInput<TGoalKeys | TQualityKeys, GoalExecutionDetail>,
  ) => TGoalEngine;

  /**
   * Map raw task properties to engine-specific task properties
   */
  mapTaskProps: (props: {
    raw: RawProps<TTaskKeys>;
    name: string;
    id: string;
    /** its text as written (`T1.1: Name [W = 0.1]`), for an engine that reads its bracket */
    text: string;
  }) => TTaskEngine;

  /**
   * Optional: Transform props after tree is created (e.g., resolve dependsOn)
   * Called for each node after the full tree is built
   * rawProperties is a discriminated union with type: 'goal' | 'task' | 'resource'
   */
  afterCreationMapper?: (props: {
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    rawProperties: RawPropertiesUnion<TGoalKeys, TTaskKeys, TResourceKeys>;
  }) => TGoalEngine | TTaskEngine | TResourceEngine;
} & ResourceMapperConfig<TResourceEngine, TResourceKeys>;

/**
 * Curried helper to create an engine mapper with full type inference.
 * First call provides the engine types (explicit), second call provides keys and mappers (keys inferred).
 *
 * @example
 * const mapper = createEngineMapper<GoalProps, TaskProps, ResourceProps>()({
 *   allowedGoalKeys: ['utility', 'cost'] as const,
 *   allowedTaskKeys: ['maxRetries'] as const,
 *   allowedResourceKeys: ['type', 'value'] as const,
 *   mapGoalProps: ({ raw }) => ({ utility: raw.utility }), // raw is typed!
 *   mapTaskProps: ({ raw }) => ({ retries: raw.maxRetries }),
 *   mapResourceProps: ({ raw }) => ({ type: raw.type }),
 * });
 */
export function createEngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = never,
>() {
  return <
    TGoalKeys extends string,
    TTaskKeys extends string,
    TResourceKeys extends string = never,
    TQualityKeys extends string = never,
    TDialect extends ReadingDialect = ReadingDialect,
  >(
    config: {
      /** the engine's definition: `executionDetail` names its constructs and modifiers */
      dialect: TDialect;
      allowedGoalKeys: readonly TGoalKeys[];
      allowedTaskKeys: readonly TTaskKeys[];
      allowedQualityKeys?: readonly TQualityKeys[];
      allowLeafGoals?: boolean;
      mapGoalProps: (
        props: GoalPropsInput<
          TGoalKeys | TQualityKeys,
          ExecutionDetailOf<TDialect>
        >,
      ) => TGoalEngine;
      mapTaskProps: (props: {
        raw: RawProps<TTaskKeys>;
        name: string;
        id: string;
        text: string;
      }) => TTaskEngine;
      afterCreationMapper?: (props: {
        node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
        allNodes: Map<
          string,
          TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
        >;
        rawProperties: RawPropertiesUnion<TGoalKeys, TTaskKeys, TResourceKeys>;
      }) => TGoalEngine | TTaskEngine | TResourceEngine;
    } & (
      | {
          allowedResourceKeys: readonly TResourceKeys[];
          skipResource?: false;
          mapResourceProps: (props: {
            raw: RawProps<TResourceKeys>;
            id: string;
          }) => TResourceEngine;
        }
      | {
          allowedResourceKeys?: undefined;
          skipResource: true;
          mapResourceProps?: never;
        }
    ),
  ): EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys
  > => {
    const skipResource = config.allowedResourceKeys === undefined;
    // goal-tree reads goal texts with the reader derived from `config.dialect`,
    // whose details name that dialect's constructs: what mapGoalProps is typed with
    const mapGoalProps = config.mapGoalProps as (
      props: GoalPropsInput<TGoalKeys | TQualityKeys, GoalExecutionDetail>,
    ) => TGoalEngine;

    // If skipResource is explicitly set (no allowedResourceKeys), skip resource mapping
    if (skipResource) {
      const result: EngineMapper<
        TGoalEngine,
        TTaskEngine,
        TResourceEngine,
        TGoalKeys,
        TTaskKeys,
        TResourceKeys,
        TQualityKeys
      > = {
        dialect: config.dialect,
        allowedGoalKeys: config.allowedGoalKeys,
        allowedTaskKeys: config.allowedTaskKeys,
        allowedQualityKeys: config.allowedQualityKeys,
        allowLeafGoals: config.allowLeafGoals,
        mapGoalProps,
        mapTaskProps: config.mapTaskProps,
        afterCreationMapper: config.afterCreationMapper,
        skipResource: true,
        mapResourceProps: undefined,
        allowedResourceKeys: undefined,
      };
      return result;
    }

    // If allowedResourceKeys is defined, mapResourceProps MUST be provided
    if (!config.mapResourceProps) {
      throw new Error(
        '[INVALID MAPPER]: allowedResourceKeys is defined but mapResourceProps is missing. ' +
          'Either provide mapResourceProps or set skipResource: true.',
      );
    }

    const result: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TGoalKeys,
      TTaskKeys,
      TResourceKeys,
      TQualityKeys
    > = {
      dialect: config.dialect,
      allowedGoalKeys: config.allowedGoalKeys,
      allowedTaskKeys: config.allowedTaskKeys,
      allowedQualityKeys: config.allowedQualityKeys,
      allowLeafGoals: config.allowLeafGoals,
      allowedResourceKeys: config.allowedResourceKeys,
      mapGoalProps,
      mapTaskProps: config.mapTaskProps,
      mapResourceProps: config.mapResourceProps,
      afterCreationMapper: config.afterCreationMapper,
    };
    return result;
  };
}

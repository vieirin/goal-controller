/**
 * Engine Mapper types and factory function
 * Defines how raw iStar properties are mapped to engine-specific properties
 */
import type { GoalExecutionDetail, TreeNode } from '../types/';

/**
 * Raw custom properties extracted from the iStar model
 * Generic type that creates a Record of allowed keys to optional string values
 */
export type RawProps<TKeys extends string> = Partial<Record<TKeys, string>>;

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
      }) => TResourceEngine;
      allowedResourceKeys: readonly TResourceKeys[];
    };

/**
 * Engine mapper interface for creating engine-specific properties
 * TGoalKeys, TTaskKeys, TResourceKeys define which custom properties are extracted
 */
export type EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = unknown,
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
> = {
  /**
   * Allowed keys for goal custom properties
   */
  allowedGoalKeys: readonly TGoalKeys[];

  /**
   * Allowed keys for task custom properties
   */
  allowedTaskKeys: readonly TTaskKeys[];

  /**
   * Map raw goal properties to engine-specific goal properties
   */
  mapGoalProps: (props: {
    raw: RawProps<TGoalKeys>;
    executionDetail: GoalExecutionDetail | null;
  }) => TGoalEngine;

  /**
   * Map raw task properties to engine-specific task properties
   */
  mapTaskProps: (props: {
    raw: RawProps<TTaskKeys>;
    name: string;
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
  >(
    config: {
      allowedGoalKeys: readonly TGoalKeys[];
      allowedTaskKeys: readonly TTaskKeys[];
      mapGoalProps: (props: {
        raw: RawProps<TGoalKeys>;
        executionDetail: GoalExecutionDetail | null;
      }) => TGoalEngine;
      mapTaskProps: (props: {
        raw: RawProps<TTaskKeys>;
        name: string;
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
    TResourceKeys
  > => {
    const skipResource = config.allowedResourceKeys === undefined;

    // If skipResource is explicitly set (no allowedResourceKeys), skip resource mapping
    if (skipResource) {
      const result: EngineMapper<
        TGoalEngine,
        TTaskEngine,
        TResourceEngine,
        TGoalKeys,
        TTaskKeys,
        TResourceKeys
      > = {
        allowedGoalKeys: config.allowedGoalKeys,
        allowedTaskKeys: config.allowedTaskKeys,
        mapGoalProps: config.mapGoalProps,
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
      TResourceKeys
    > = {
      allowedGoalKeys: config.allowedGoalKeys,
      allowedTaskKeys: config.allowedTaskKeys,
      allowedResourceKeys: config.allowedResourceKeys,
      mapGoalProps: config.mapGoalProps,
      mapTaskProps: config.mapTaskProps,
      mapResourceProps: config.mapResourceProps,
      afterCreationMapper: config.afterCreationMapper,
    };
    return result;
  };
}

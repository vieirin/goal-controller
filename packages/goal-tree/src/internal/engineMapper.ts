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
 */
export type RawPropertiesUnion<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
> =
  | { type: 'goal'; raw: RawProps<TGoalKeys> }
  | { type: 'task'; raw: RawProps<TTaskKeys> }
  | { type: 'resource'; raw: RawProps<TResourceKeys> };

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
  mapTaskProps: (props: { raw: RawProps<TTaskKeys> }) => TTaskEngine;

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
 * First call provides the keys (inferring key types), second call provides the mappers.
 *
 * @example
 * const mapper = createEngineMapper({
 *   allowedGoalKeys: ['utility', 'cost'] as const,
 *   allowedTaskKeys: ['maxRetries'] as const,
 *   allowedResourceKeys: ['type', 'value'] as const,
 * })({
 *   mapGoalProps: ({ raw }) => ({ utility: raw.utility }), // raw is typed!
 *   mapTaskProps: ({ raw }) => ({ retries: raw.maxRetries }),
 *   mapResourceProps: ({ raw }) => ({ type: raw.type }),
 * });
 */
export function createEngineMapper<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string = never,
>(
  keys: {
    allowedGoalKeys: readonly TGoalKeys[];
    allowedTaskKeys: readonly TTaskKeys[];
  } & (
    | { allowedResourceKeys: readonly TResourceKeys[]; skipResource?: false }
    | { allowedResourceKeys?: undefined; skipResource: true }
  ),
) {
  return <TGoalEngine, TTaskEngine, TResourceEngine = never>(
    mappers: {
      mapGoalProps: (props: {
        raw: RawProps<TGoalKeys>;
        executionDetail: GoalExecutionDetail | null;
      }) => TGoalEngine;
      mapTaskProps: (props: { raw: RawProps<TTaskKeys> }) => TTaskEngine;
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
          mapResourceProps: (props: {
            raw: RawProps<TResourceKeys>;
          }) => TResourceEngine;
        }
      | { mapResourceProps?: never }
    ),
  ): EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  > => {
    const skipResource = keys.allowedResourceKeys === undefined;
    if (skipResource || !mappers.mapResourceProps) {
      const result: EngineMapper<
        TGoalEngine,
        TTaskEngine,
        TResourceEngine,
        TGoalKeys,
        TTaskKeys,
        TResourceKeys
      > = {
        ...keys,
        ...mappers,
        skipResource: true,
        mapResourceProps: undefined,
        allowedResourceKeys: undefined,
      };
      return result;
    }
    const result: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TGoalKeys,
      TTaskKeys,
      TResourceKeys
    > = {
      ...keys,
      ...mappers,
    };
    return result;
  };
}

/**
 * Edge Engine Mapper
 * Maps raw iStar model properties to Edge/PRISM engine-specific properties
 */
import {
  createEngineMapper,
  type GoalNode,
  type GoalTreeType,
  type Resource,
  type Task,
} from '@goal-controller/goal-tree';
import { propertyKeys } from '@goal-controller/dialect';
import { edgeV2 } from './definition';
import {
  edgeDependsOn,
  edgeGoalProps,
  edgeResourceProps,
  edgeTaskProps,
} from '../edgeFamily/mapper';
import type {
  Decision,
  EdgeResourceProps,
  EdgeTaskProps,
  ExecCondition,
  GoalExecutionDetail,
} from './types';

// the custom properties it reads, per kind: from the engine's definition
export const EDGE_GOAL_KEYS = propertyKeys(edgeV2, 'goal');
export const EDGE_TASK_KEYS = propertyKeys(edgeV2, 'task');
export const EDGE_RESOURCE_KEYS = propertyKeys(edgeV2, 'resource');

// Type aliases for the allowed keys
export type EdgeGoalKey = (typeof EDGE_GOAL_KEYS)[number];
export type EdgeTaskKey = (typeof EDGE_TASK_KEYS)[number];
export type EdgeResourceKey = (typeof EDGE_RESOURCE_KEYS)[number];

// Using an interface allows circular references (interfaces are lazily evaluated)
// This gives us proper typing: dependsOn[0].properties.engine is EdgeGoalPropsResolved
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface EdgeGoalPropsResolved {
  utility: string;
  cost: string;
  dependsOn: EdgeGoalNode[];
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
  decision: Decision;
  maxRetries: number;
}

/**
 * Edge Engine Mapper for creating EDGE/PRISM-compatible goal trees
 * Engine types are explicit, property types are inferred from the dialect;
 * what it makes of them is edgeFamily's (edge and edgeV2 read them the same)
 */
export const edgeEngineMapper = createEngineMapper<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>()({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: edgeV2,
  mapGoalProps: edgeGoalProps,

  mapTaskProps: edgeTaskProps,

  mapResourceProps: edgeResourceProps,

  afterCreationMapper: ({ node, allNodes, rawProperties }) => {
    // Only process goal nodes for dependsOn resolution
    if (rawProperties.nodeType !== 'goal' || node.type !== 'goal') {
      // For non-goal nodes, return the existing engine props
      return node.properties.engine;
    }

    return {
      ...node.properties.engine,
      dependsOn: edgeDependsOn(
        node.id,
        rawProperties,
        allNodes as Map<string, EdgeGoalNode>,
      ),
    };
  },
});

/**
 * Type aliases for Edge-specific tree types
 */
export type EdgeGoalNode = GoalNode<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>;
export type EdgeTask = Task<EdgeTaskProps, EdgeResourceProps>;
export type EdgeResource = Resource<EdgeResourceProps>;
export type EdgeGoalTree = GoalTreeType<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>;

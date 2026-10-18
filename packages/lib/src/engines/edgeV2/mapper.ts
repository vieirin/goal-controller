/**
 * Edge Engine Mapper
 * Maps raw iStar model properties to Edge/PRISM engine-specific properties
 */
import {
  createEngineMapper,
  useIstarDefaultNaming,
  type IstarNaming,
  type IstarProps,
  type KindNode,
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
 * Edge Engine Mapper for creating EDGE/PRISM-compatible goal trees: the iStar
 * reading, an entry per kind. What it makes of the properties is edgeFamily's
 * (edge and edgeV2 read them the same).
 */
export const edgeEngineMapper = createEngineMapper({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: edgeV2,
  naming: useIstarDefaultNaming(),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: (input): EdgeGoalPropsResolved =>
        input.kind === 'istar.Goal'
          ? edgeGoalProps<GoalExecutionDetail, EdgeGoalNode>(input)
          : edgeGoalProps<GoalExecutionDetail, EdgeGoalNode>({
              id: input.id,
              props: {},
              raw: {},
              executionDetail: input.executionDetail,
            }),
      // dependsOn names other goals: resolved once every node is built
      afterCreation: ({ node, input, allNodes }): EdgeGoalPropsResolved =>
        input.kind === 'istar.Goal'
          ? {
              ...node.properties.engine,
              dependsOn: edgeDependsOn<EdgeGoalNode>(node.id, input, allNodes),
            }
          : { ...node.properties.engine, dependsOn: [] },
    }),
    entry({ kind: 'istar.Task', mapProps: edgeTaskProps }),
    entry({ kind: 'istar.Resource', mapProps: edgeResourceProps }),
  ],
});

/**
 * Edge-specific tree types. A goal's dependsOn holds goal nodes, so the node
 * type is written out rather than taken from the mapper (`NodeOf` would be
 * circular).
 */
export type EdgeNode = KindNode<
  IstarProps<EdgeGoalPropsResolved, EdgeTaskProps, EdgeResourceProps>,
  IstarNaming,
  'istar'
>;
export type EdgeGoalNode = Extract<EdgeNode, { type: 'goal' }>;
export type EdgeTask = Extract<EdgeNode, { type: 'task' }>;
export type EdgeResource = Extract<EdgeNode, { type: 'resource' }>;
export type EdgeGoalTree = EdgeNode[];

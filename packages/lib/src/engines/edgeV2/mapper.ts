/**
 * Edge Engine Mapper
 * Maps raw iStar model properties to Edge/PRISM engine-specific properties
 */
import { propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  useIstarDefaultNaming,
  type IstarNaming,
  type IstarProps,
  type KindNode,
  type NodeOf,
} from '@goal-controller/goal-tree';
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

/**
 * A goal's engine properties. `dependsOn` holds the tree's own goal nodes
 * (`KindNode`, not a circular `NodeOf<typeof mapper>`).
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface EdgeGoalPropsResolved {
  utility: string;
  cost: string;
  dependsOn: Array<
    Extract<
      KindNode<
        IstarProps<EdgeGoalPropsResolved, EdgeTaskProps, EdgeResourceProps>,
        IstarNaming,
        'istar'
      >,
      { type: 'goal' }
    >
  >;
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
  decision: Decision;
  maxRetries: number;
}

const emptyGoalProps = (): EdgeGoalPropsResolved => ({
  utility: '',
  cost: '',
  dependsOn: [],
  executionDetail: null,
  decision: { decisionVars: [], hasDecision: false },
  maxRetries: 0,
});

/**
 * EdgeV2's mapper: the iStar reading, an entry per kind (#215). Quality has no
 * dialect keys; dependsOn is resolved in afterCreation to the tree's nodes
 * (#233), rejecting a Quality the same way the check does (#266).
 */
export const edgeEngineMapper = createEngineMapper({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: edgeV2,
  naming: useIstarDefaultNaming(),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({
        kind,
        props,
        raw,
        id,
        executionDetail,
      }): EdgeGoalPropsResolved => {
        // Quality has no properties in the dialect; Goal's keys need a narrow
        if (kind !== 'istar.Goal') return emptyGoalProps();
        return edgeGoalProps({ props, raw, id, executionDetail });
      },
      afterCreation: ({ node, input, allNodes }): EdgeGoalPropsResolved => {
        if (node.kind !== 'istar.Goal' || input.kind !== 'istar.Goal') {
          return node.properties.engine;
        }
        return {
          ...node.properties.engine,
          dependsOn: edgeDependsOn(
            node.id,
            input,
            allNodes as Map<string, EdgeNode>,
          ),
        };
      },
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ props, raw, id }) => edgeTaskProps({ props, raw, id }),
    }),
    entry({
      kind: 'istar.Resource',
      mapProps: ({ props, raw, id }) => edgeResourceProps({ props, raw, id }),
    }),
  ],
});

/** EdgeV2's tree nodes, by kind. */
export type EdgeNode = NodeOf<typeof edgeEngineMapper>;
export type EdgeGoalNode = Extract<EdgeNode, { type: 'goal' }>;
export type EdgeTask = Extract<EdgeNode, { type: 'task' }>;
export type EdgeResource = Extract<EdgeNode, { type: 'resource' }>;
export type EdgeGoalTree = EdgeNode[];

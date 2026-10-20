import type { ExecutionDetailOf } from '@goal-controller/goal-language';
import type { Decision, ExecCondition } from '../edgeFamily/types';
import type { edgeV2 } from './definition';
/**
 * Edge Engine Types
 * Types for EDGE/PRISM template engine properties
 */

export type {
  Condition,
  Decision,
  EdgeResourceProps,
  EdgeResourceVariable,
  EdgeTaskProps,
  ExecCondition,
} from '../edgeFamily/types';

/**
 * What a goal's notation makes it do, as edgeV2's definition names it: `type` is
 * one of its constructs, `modifiers` has its modifiers (`retry`), so a
 * misspelt name doesn't compile.
 */
export type GoalExecutionDetail = ExecutionDetailOf<typeof edgeV2>;

// `dependsOn` holds goal nodes of the engine's tree, its type a parameter (`EdgeGoalPropsResolved` fixes it)
export type EdgeGoalProps<TGoalNode = unknown> = {
  utility: string;
  cost: string;
  dependsOn: TGoalNode[];
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
  decision: Decision;
  maxRetries: number;
};

// Re-export mapper types for convenience
export type {
  EdgeGoalNode,
  EdgeTask,
  EdgeResource,
  EdgeGoalTree,
  EdgeGoalPropsResolved,
} from './mapper';

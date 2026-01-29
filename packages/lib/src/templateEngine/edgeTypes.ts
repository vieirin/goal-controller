/**
 * Edge Engine Type Re-exports
 * Common types for use across template engine modules
 */

// Re-export from edgeMapper
export type {
  EdgeGoalNode,
  EdgeTask,
  EdgeResource,
  EdgeGoalTree,
  EdgeGoalPropsResolved,
} from './edgeMapper';

// Re-export Edge prop types
export type {
  EdgeGoalProps,
  EdgeTaskProps,
  EdgeResourceProps,
  EdgeResourceVariable,
  ExecCondition,
  Decision,
  GoalExecutionDetail,
} from './types';

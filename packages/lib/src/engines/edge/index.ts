/**
 * Edge Engine
 * Generates PRISM models for probabilistic verification
 *
 * Architecture:
 * - mapper.ts: Engine creation - maps raw iStar model to Edge-specific properties
 * - template/: Transformation - generates PRISM model output
 */

// Engine creation (mapper)
export {
  edgeEngineMapper,
  type EdgeGoalNode,
  type EdgeTask,
  type EdgeResource,
  type EdgeGoalTree,
  type EdgeGoalPropsResolved,
  EDGE_GOAL_KEYS,
  EDGE_TASK_KEYS,
  EDGE_RESOURCE_KEYS,
  type EdgeGoalKey,
  type EdgeTaskKey,
  type EdgeResourceKey,
} from './mapper';

// Types
export type {
  EdgeGoalProps,
  EdgeTaskProps,
  EdgeResourceProps,
  EdgeResourceVariable,
  ExecCondition,
  Decision,
  GoalExecutionDetail,
} from './types';

// Transformation (template engine)
export { generateValidatedPrismModel } from './template';

// Logger
export { initLogger, getLogger, type LoggerReport } from './logger/logger';

// Validator
export { validate, formatValidationReport } from './validator';

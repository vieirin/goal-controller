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
  EDGE_GOAL_KEYS,
  EDGE_RESOURCE_KEYS,
  EDGE_TASK_KEYS,
  edgeEngineMapper,
  type EdgeGoalKey,
  type EdgeGoalNode,
  type EdgeGoalPropsResolved,
  type EdgeGoalTree,
  type EdgeResource,
  type EdgeResourceKey,
  type EdgeTask,
  type EdgeTaskKey,
} from './mapper';

// Types
export type {
  Decision,
  EdgeGoalProps,
  EdgeResourceProps,
  EdgeResourceVariable,
  EdgeTaskProps,
  ExecCondition,
  GoalExecutionDetail,
} from './types';

// Transformation (template engine)
export { generateValidatedPrismModel } from './template';

// Logger
export { getLogger, initLogger, type LoggerReport } from './logger/logger';

// Validator
export { formatValidationReport, validate } from './validator';

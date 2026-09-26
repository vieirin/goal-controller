// Variable names (module vars use lowercase id: G0 → g0_state, T1 → t1_state)
const varId = (nodeId: string): string => nodeId.toLowerCase();

/** 0 not pursued, 1 currently pursued — goals and tasks */
export const stateVariable = (nodeId: string): string => `${varId(nodeId)}_state`;
/** Achieved formula: g<id>_achieved for goals, t<id>_achieved for tasks */
export const achievedFormula = (nodeId: string): string =>
  `${varId(nodeId)}_achieved`;
/** Task module variable backing the t<id>_achieved formula */
export const taskAchievedVariable = (taskId: string): string =>
  `${varId(taskId)}_achieved_`;
export const chosenVariable = (goalId: string): string =>
  `${varId(goalId)}_chosen`;
export const goalFailedVariable = (goalId: string): string =>
  `${varId(goalId)}_failed`;

// Transition labels
export const pursueTransition = (goalId: string): string => `pursue_${goalId}`;
export const achievedTransition = (goalId: string): string =>
  `achieved_${goalId}`;
export const failedTransition = (goalId: string): string => `failed_${goalId}`;
export const tryTransition = (goalId: string): string => `try_${goalId}`;

// formulas / task failed counters (preserve original id case)
export const achievableFormulaVariable = (goalId: string): string =>
  `${goalId}_achievable`;
/** Achievement-aware share of a child among its siblings (AND anyOrder) */
export const relativeFormulaVariable = (goalId: string): string =>
  `${goalId}_relative`;
export const failed = (goalId: string): string => `${goalId}_failed`;

/** Discretisation constant: achievabilities are compared as X_achievable*N > decision_X */
export const DISCRETISATION_CONSTANT = 'N';
export const DEFAULT_DISCRETISATION = 10;

/**
 * Where task commands live:
 *   taskModules   — one module per task, declared next to its parent goal (EDGE reference layout)
 *   changeManager — all tasks in a single ChangeManager module after the goals
 */
export type TaskLayout = 'taskModules' | 'changeManager';
export const DEFAULT_TASK_LAYOUT: TaskLayout = 'taskModules';

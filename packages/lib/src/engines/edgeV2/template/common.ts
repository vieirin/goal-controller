// Variable names (goal module vars use lowercase id: G0 → g0_state)
const varId = (goalId: string): string => goalId.toLowerCase();

export const stateVariable = (goalId: string): string => `${varId(goalId)}_state`;
export const pursuedVariable = (goalId: string): string => `${goalId}_pursued`;
export const achievedVariable = (goalId: string): string =>
  `${goalId}_achieved`;
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
export const failed = (goalId: string): string => `${goalId}_failed`;

// Variable names
export const pursuedVariable = (goalId: string): string => `${goalId}_pursued`;
export const achievedVariable = (goalId: string): string =>
  `${goalId}_achieved`;
export const chosenVariable = (goalId: string): string => `${goalId}_chosen`;

// Transition labels
export const pursueTransition = (goalId: string): string => `pursue_${goalId}`;
export const achievedTransition = (goalId: string): string =>
  `achieved_${goalId}`;
export const failedTransition = (goalId: string): string => `failed_${goalId}`;
export const tryTransition = (goalId: string): string => `try_${goalId}`;

// formulas
export const achievableFormulaVariable = (goalId: string): string =>
  `${goalId}_achievable`;
export const failed = (goalId: string): string => `${goalId}_failed`;


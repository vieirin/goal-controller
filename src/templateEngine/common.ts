// Variable names
export const pursuedVariable = (goalId: string) => `${goalId}_pursued`;
export const achievedVariable = (goalId: string) => `${goalId}_achieved`;
export const chosenVariable = (goalId: string) => `${goalId}_chosen`;

// Transition labels
export const pursueTransition = (goalId: string) => `pursue_${goalId}`;
export const achievedTransition = (goalId: string) => `achieved_${goalId}`;
export const failedTransition = (goalId: string) => `failed_${goalId}`;

// formulas
export const achievableFormulaVariable = (goalId: string) =>
  `${goalId}_achievable`;

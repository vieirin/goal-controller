// Variable names
export const pursuedVariable = (goalId: string) => `${goalId}_pursued`;
export const achievedVariable = (goalId: string) => `${goalId}_achieved`;

// Transition labels
export const pursueTransition = (goalId: string) => `pursue_${goalId}`;
export const achievedTransition = (goalId: string) => `achieved_${goalId}`;

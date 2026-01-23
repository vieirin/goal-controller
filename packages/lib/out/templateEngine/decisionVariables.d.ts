import type { GoalNode, GoalTree } from '../GoalTree/types';
export declare const decisionVariablesForGoal: ({ goal, }: {
    goal: GoalNode;
}) => readonly [string[], Generator<number[]>, number[][]];
export declare const decisionVariableName: (goalId: string, variableCombination: number[], vars: string[]) => string;
export declare const decisionVariablesTemplate: ({ gm }: {
    gm: GoalTree;
}) => string;
//# sourceMappingURL=decisionVariables.d.ts.map
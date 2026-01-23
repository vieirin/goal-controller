import type { GoalNode } from '../../../../../GoalTree/types';
export declare const hasBeenAchieved: (goal: GoalNode, { condition, update }: {
    condition: boolean;
    update?: boolean;
}) => string;
export declare const hasBeenPursued: (goal: GoalNode, { condition, update }: {
    condition: boolean;
    update?: boolean;
}) => string;
export declare const hasBeenAchievedAndPursued: (goal: GoalNode, { achieved, pursued }: {
    achieved: boolean;
    pursued: boolean;
}) => string;
export declare const hasFailedAtLeastNTimes: (goalId: string, n: number) => string;
export declare const hasFailedAtMostNTimes: (goalId: string, n: number) => string;
//# sourceMappingURL=common.d.ts.map
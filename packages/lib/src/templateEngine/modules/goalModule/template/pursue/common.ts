import type { GoalNode } from '@goal-controller/goal-tree';
import { achieved, pursued, separator } from '../../../../../mdp/common';
import { achievedMaintain } from '../formulas';

export const hasBeenAchieved = (
  goal: GoalNode,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  if (goal.execCondition?.maintain) {
    if (update) {
      throw new Error(
        'Invalid update option for goal of type maintain, please verify',
      );
    }
    return `${achievedMaintain(goal.id)}=${condition ? 'true' : 'false'}`;
  }

  return `${achieved(goal.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
};

export const hasBeenPursued = (
  goal: GoalNode,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  return `${pursued(goal.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
};

export const hasBeenAchievedAndPursued = (
  goal: GoalNode,
  { achieved, pursued }: { achieved: boolean; pursued: boolean },
): string => {
  return [
    hasBeenPursued(goal, { condition: pursued }),
    hasBeenAchieved(goal, { condition: achieved }),
  ].join(separator('and'));
};

export const hasFailedAtLeastNTimes = (goalId: string, n: number): string => {
  return `${goalId}_failed >= ${n}`;
};

export const hasFailedAtMostNTimes = (goalId: string, n: number): string => {
  return `${goalId}_failed <= ${n}`;
};

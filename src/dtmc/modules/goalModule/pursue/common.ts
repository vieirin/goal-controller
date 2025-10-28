import type { GoalNode } from '../../../../GoalTree/types';
import { achieved, pursued, separator } from '../../../../mdp/common';
import { achievedMaintain } from '../../../formulas';

export const beenAchieved = (
  goalId: string,
  { condition }: { condition: boolean }
) => {
  return `${achieved(goalId)}=${condition ? 1 : 0}`;
};

export const beenPursued = (
  goal: GoalNode,
  { condition }: { condition: boolean }
) => {
  if (goal.execCondition?.maintain) {
    return `${achievedMaintain(goal.id)}=${condition ? 'true' : 'false'}`;
  }
  return `${pursued(goal.id)}=${condition ? 1 : 0}`;
};

export const beenAchievedAndPursued = (
  goal: GoalNode,
  { achieved, pursued }: { achieved: boolean; pursued: boolean }
) => {
  return [
    beenPursued(goal, { condition: pursued }),
    beenAchieved(goal.id, { condition: achieved }),
  ].join(separator('and'));
};

export const hasFailedAtLeastNTimes = (goalId: string, n: number) => {
  return `${goalId}_failed >= ${n}`;
};

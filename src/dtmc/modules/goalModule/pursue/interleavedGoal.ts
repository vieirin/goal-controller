import { separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { beenPursued, hasFailedAtLeastNTimes } from './common';

export const pursueInterleavedGoal = (
  goal: GoalNode,
  interleaved: string[],
  currentChildId: string
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Interleaved goals are not supported for and joints. Found in goal ${goal.id}`
    );
  }

  if (goal.relationToChildren === 'or') {
    const otherGoals = interleaved.filter(
      (goalId) => goalId !== currentChildId
    );
    return otherGoals
      .map((goalId) => {
        const defaultCondition = beenPursued(goalId, { condition: false });
        const maybeRetry = goal.executionDetail?.retryMap?.[goalId];
        const retryCondition =
          maybeRetry && hasFailedAtLeastNTimes(goalId, maybeRetry - 1);

        return [defaultCondition, retryCondition]
          .filter(Boolean)
          .join(separator('and'));
      })
      .join(separator('and'));
  }

  return '';
};

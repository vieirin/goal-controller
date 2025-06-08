import { separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { beenPursued, hasFailedAtLeastNTimes } from './common';

export const pursueAlternativeGoal = (
  goal: GoalNode,
  alternative: string[],
  currentChildId: string
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      `Alternative goals are not supported for OR joints. Found in goal ${goal.id}`
    );
  }

  if (goal.relationToChildren === 'and') {
    const otherGoals = alternative.filter(
      (goalId) => goalId !== currentChildId
    );
    return otherGoals
      .map((goalId) => {
        const defaultCondition = beenPursued(goalId, { condition: false });
        const maybeRetry = goal.executionDetail?.retryMap?.[goalId];
        const retryCondition =
          maybeRetry && hasFailedAtLeastNTimes(goalId, maybeRetry);

        return [defaultCondition, retryCondition]
          .filter(Boolean)
          .join(separator('and'));
      })
      .join(separator('and'));
  }

  return '';
};

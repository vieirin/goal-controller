import { pursued, separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { beenPursued, hasFailedAtLeastNTimes } from './common';

export const pursueAlternativeGoal = (
  goal: GoalNode,
  alternative: string[],
  currentChildId: string
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Alternative goals are not supported for AND joints. Found in goal ${goal.id}`
    );
  }

  if (goal.relationToChildren === 'or') {
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

export const pursueAnyGoal = (
  goal: GoalNode,
  currentChildId: string
): string => {
  const children = goal.children?.length ? goal.children : goal.tasks ?? [];
  const otherGoals = children.filter((child) => child.id !== currentChildId);

  return otherGoals
    .map((child) => {
      return `${pursued(child.id)}=0`;
    })
    .join(separator('and'));
};

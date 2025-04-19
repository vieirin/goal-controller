import type { GoalNodeWithParent } from '../ObjectiveTree/types';

export const achievedMaintain = (goalId: string) => {
  return `${goalId}_achieved_maintain`;
};

export const maintainConditionFormula = (goal: GoalNodeWithParent) => {
  if (!goal.maintainCondition) {
    return '';
  }
  return `formula ${achievedMaintain(goal.id)} = ${goal.maintainCondition.maintain || 'ASSERTION_UNDEFINED'};`;
};

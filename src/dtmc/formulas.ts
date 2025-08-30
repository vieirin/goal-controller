import type { GoalNodeWithParent } from '../ObjectiveTree/types';

export const achievedMaintain = (goalId: string) => {
  return `${goalId}_achieved_maintain`;
};

export const maintainConditionFormula = (goal: GoalNodeWithParent) => {
  if (!goal.execCondition?.maintain) {
    return '';
  }
  return `formula ${achievedMaintain(goal.id)} = ${
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED'
  };`;
};

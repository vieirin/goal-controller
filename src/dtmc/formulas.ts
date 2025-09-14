import { getLogger } from '../logger/logger';
import type { GoalNodeWithParent } from '../ObjectiveTree/types';

export const achievedMaintain = (goalId: string) => {
  return `${goalId}_achieved_maintain`;
};

export const maintainConditionFormula = (goal: GoalNodeWithParent) => {
  if (!goal.execCondition?.maintain) {
    return '';
  }
  const logger = getLogger();

  const prismLine = `formula ${achievedMaintain(goal.id)} = ${
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED'
  };`;

  logger.formulaDefinition(
    achievedMaintain(goal.id),
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED',
    prismLine
  );
  return prismLine;
};

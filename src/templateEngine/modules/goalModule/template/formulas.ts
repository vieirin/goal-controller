import type { GoalNodeWithParent } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { parenthesis } from '../../../../mdp/common';

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
    goal.id,
    achievedMaintain(goal.id),
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED',
    prismLine
  );
  return prismLine;
};

export const achievableGoalFormula = (goal: GoalNodeWithParent) => {
  const children = [...(goal.children || []), ...(goal.tasks || [])];
  const sumPart = children.join(' + ');
  const multPart = children.join(' * ');
  return `${goal.id}_achievable = ${sumPart} - ${parenthesis(multPart)}`;
};

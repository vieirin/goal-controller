import type { GoalNodeWithParent } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { parenthesis } from '../../../../mdp/common';
import { achievableFormulaVariable } from '../../../common';

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

  if (children.length === 1) {
    return `formula ${goal.id}_achievable = ${achievableFormulaVariable(
      children[0]!.id
    )}`;
  }

  const childrenVariables = children.map((child) =>
    achievableFormulaVariable(child.id)
  );

  const sumPart = childrenVariables.join(' + ');
  const multPart = childrenVariables.join(' * ');

  return `formula ${goal.id}_achievable = ${sumPart} - ${parenthesis(
    multPart
  )}`;
};

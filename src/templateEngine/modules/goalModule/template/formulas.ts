import type { GoalNode } from '../../../../GoalTree/types';
import { childrenIncludingTasks } from '../../../../GoalTree/utils';
import { getLogger } from '../../../../logger/logger';
import { parenthesis } from '../../../../mdp/common';
import { achievableFormulaVariable } from '../../../common';

export const achievedMaintain = (goalId: string) => {
  return `${goalId}_achieved_maintain`;
};

export const maintainConditionFormula = (goal: GoalNode) => {
  if (!goal.execCondition?.maintain) {
    return '';
  }
  const logger = getLogger();

  const prismLine = `formula ${achievedMaintain(goal.id)} = ${
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED'
  };`;

  logger.maintainFormulaDefinition(
    goal.id,
    achievedMaintain(goal.id),
    goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED',
    prismLine,
  );
  return prismLine;
};

export const achievableGoalFormula = (goal: GoalNode) => {
  const children = childrenIncludingTasks({ node: goal });
  const formulaName = `${achievableFormulaVariable(goal.id)}`;
  const logger = getLogger();
  if (children.length === 1) {
    const firstChild = children[0];
    if (!firstChild) {
      throw new Error(
        `Expected at least one child for goal ${goal.id} but children array is empty`,
      );
    }
    return `formula ${formulaName} = ${achievableFormulaVariable(
      firstChild.id,
    )};`;
  }

  const childrenVariables = children.map((child) =>
    achievableFormulaVariable(child.id),
  );
  const productPart = childrenVariables.join(' * ');

  switch (goal.relationToChildren) {
    case 'and': {
      const andFormula = `formula ${formulaName} = ${productPart};`;
      logger.achievabilityFormulaDefinition(
        goal.id,
        formulaName,
        'AND',
        productPart,
        andFormula,
      );
      return andFormula;
    }
    case 'or': {
      const sumPart = childrenVariables.join(' + ');
      const formulaValue = `${sumPart} - ${parenthesis(productPart)}`;
      const orFormula = `formula ${formulaName} = ${formulaValue};`;
      logger.achievabilityFormulaDefinition(
        goal.id,
        formulaName,
        'OR',
        formulaValue,
        orFormula,
      );
      return orFormula;
    }
    default:
      throw new Error(
        `Invalid relation to children: ${goal.relationToChildren ?? 'none'}`,
      );
  }
};

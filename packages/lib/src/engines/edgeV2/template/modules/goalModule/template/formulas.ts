import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import { separator } from '../../../../mdp/common';
import type { EdgeGoalNode } from '../../../../types';
import { achievedVariable } from '../../../common';

export const achievedMaintain = (goalId: string): string => {
  return `${goalId}_achieved_maintain`;
};

export const maintainConditionFormula = (goal: EdgeGoalNode): string => {
  if (!goal.properties.engine.execCondition?.maintain) {
    return '';
  }
  const logger = getLogger();

  const prismLine = `formula ${achievedMaintain(goal.id)} = ${
    goal.properties.engine.execCondition.maintain.sentence ||
    'ASSERTION_UNDEFINED'
  };`;

  logger.maintainFormulaDefinition(
    goal.id,
    achievedMaintain(goal.id),
    goal.properties.engine.execCondition.maintain.sentence ||
      'ASSERTION_UNDEFINED',
    prismLine,
  );
  return prismLine;
};

export const achievedGoalFormula = (goal: EdgeGoalNode): string => {
  const children = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  );
  const formulaName = `${achievedVariable(goal.id)}`;
  const logger = getLogger();
  const childrenAchievedExpressions = children.map((child) =>
    achievedVariable(child.id),
  );

  if (childrenAchievedExpressions.length === 0) {
    const formula = `formula ${formulaName} = false;`;
    logger.achievabilityFormulaDefinition(
      goal.id,
      formulaName,
      'SINGLE_GOAL',
      'false',
      formula,
    );
    return formula;
  }

  if (childrenAchievedExpressions.length === 1) {
    const [onlyChildExpression] = childrenAchievedExpressions;
    if (!onlyChildExpression) {
      throw new Error(`Expected achieved expression for goal ${goal.id}`);
    }
    const formula = `formula ${formulaName} = ${onlyChildExpression};`;
    logger.achievabilityFormulaDefinition(
      goal.id,
      formulaName,
      'SINGLE_GOAL',
      onlyChildExpression,
      formula,
    );
    return formula;
  }

  const relation = goal.relationToChildren === 'and' ? 'and' : 'or';
  const sentence = `(${childrenAchievedExpressions.join(separator(relation))})`;
  const formula = `formula ${formulaName} = ${sentence};`;
  logger.achievabilityFormulaDefinition(
    goal.id,
    formulaName,
    relation === 'and' ? 'AND' : 'OR',
    sentence,
    formula,
  );
  return formula;
};

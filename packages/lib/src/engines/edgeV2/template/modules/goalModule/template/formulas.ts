import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import { parenthesis, separator } from '../../../../mdp/common';
import type { EdgeGoalNode } from '../../../../types';
import { achievableFormulaVariable, achievedVariable } from '../../../common';

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

/** Same combinators as Edge v1: `*` for AND children, inclusion–exclusion for OR. */
export const achievableGoalFormula = (goal: EdgeGoalNode): string => {
  const children = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  );
  const formulaName = achievableFormulaVariable(goal.id);
  const logger = getLogger();

  if (children.length === 0) {
    const formula = `formula ${formulaName} = 1;`;
    logger.achievabilityFormulaDefinition(
      goal.id,
      formulaName,
      'LEAF',
      '1',
      formula,
    );
    return formula;
  }

  if (children.length === 1) {
    const firstChild = children[0];
    if (!firstChild) {
      throw new Error(
        `Expected at least one child for goal ${goal.id} but children array is empty`,
      );
    }
    const sentence = achievableFormulaVariable(firstChild.id);
    const formula = `formula ${formulaName} = ${sentence};`;
    logger.achievabilityFormulaDefinition(
      goal.id,
      formulaName,
      'SINGLE_GOAL',
      sentence,
      formula,
    );
    return formula;
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

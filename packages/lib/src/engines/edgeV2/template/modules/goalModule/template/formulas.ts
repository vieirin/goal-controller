import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import { parenthesis, separator } from '../../../../mdp/common';
import {
  achievableFormulaVariable,
  achievedFormula,
  achievedVariable,
} from '../../../../template/common';

/** @deprecated Use achievedFormula — maintain goals share g*_achieved */
export const achievedMaintain = achievedFormula;

export const maintainConditionFormula = (goal: EdgeGoalNode): string => {
  if (!goal.properties.engine.execCondition?.maintain) {
    return '';
  }
  const logger = getLogger();
  const name = achievedFormula(goal.id);

  const prismLine = `formula ${name} = ${
    goal.properties.engine.execCondition.maintain.sentence ||
    'ASSERTION_UNDEFINED'
  };`;

  logger.maintainFormulaDefinition(
    goal.id,
    name,
    goal.properties.engine.execCondition.maintain.sentence ||
      'ASSERTION_UNDEFINED',
    prismLine,
  );
  return prismLine;
};

/** Child achieved ref: goal → g*_achieved formula; task → T*_achieved var */
const childAchievedRef = (child: EdgeGoalNode | EdgeTask): string =>
  Node.isTask(child) ? achievedVariable(child.id) : achievedFormula(child.id);

/**
 * EDGEV2 achieved formula:
 *   formula g0_achieved = (g1_achieved & g2_achieved);  // AND
 *   formula g0_achieved = (g1_achieved | g2_achieved);  // OR
 * Skipped for maintain goals (maintainConditionFormula emits g*_achieved from the maintain sentence).
 */
export const achievedGoalFormula = (goal: EdgeGoalNode): string => {
  if (goal.properties.engine.execCondition?.maintain) {
    return '';
  }

  const children = Node.children(goal).filter(
    (child): child is EdgeGoalNode | EdgeTask => !Node.isResource(child),
  );
  if (children.length === 0) {
    return '';
  }

  const formulaName = achievedFormula(goal.id);
  const childRefs = children.map(childAchievedRef);

  let sentence: string;
  if (children.length === 1) {
    sentence = childRefs[0]!;
  } else {
    switch (goal.relationToChildren) {
      case 'and':
        sentence = parenthesis(childRefs.join(separator('and')));
        break;
      case 'or':
        sentence = parenthesis(childRefs.join(separator('or')));
        break;
      default:
        throw new Error(
          `Invalid relation to children for achieved formula: ${goal.relationToChildren ?? 'none'}`,
        );
    }
  }

  return `formula ${formulaName} = ${sentence};`;
};

export const achievableGoalFormula = (goal: EdgeGoalNode): string => {
  const children = Node.children(goal);
  const formulaName = `${achievableFormulaVariable(goal.id)}`;
  const logger = getLogger();
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

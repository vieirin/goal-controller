import type { EdgeGoalNode } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import { parenthesis, separator } from '../../../../mdp/common';
import {
  achievableFormulaVariable,
  achievedFormula,
  chosenVariable,
  relativeFormulaVariable,
} from '../../../../template/common';
import { construct, orderedChildIds, retriedChildren } from './children';
import { hasFailedExactlyNTimes } from './pursue/common';

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

const isAnd = (goal: EdgeGoalNode): boolean =>
  ['sequence', 'anyOrder', 'interleaved'].includes(construct(goal));

/**
 * Achieved formula (children are goals or tasks, both expose x_achieved):
 *   AND:          formula g0_achieved = (g1_achieved & g2_achieved);
 *   OR:           formula g0_achieved = (g1_achieved | g2_achieved);
 *   degradation:  formula g0_achieved = (g1_achieved | (g1_failed=K & g2_achieved));
 *                 a fallback child only counts once the earlier retries are exhausted
 * Skipped for maintain goals (maintainConditionFormula emits g*_achieved).
 */
export const achievedGoalFormula = (goal: EdgeGoalNode): string => {
  if (goal.properties.engine.execCondition?.maintain) {
    return '';
  }
  const childIds = orderedChildIds(goal);
  if (childIds.length === 0) {
    return '';
  }

  let terms = childIds.map(achievedFormula);
  if (construct(goal) === 'degradation') {
    const chain = retriedChildren(goal);
    terms = childIds.map((id, index) => {
      const gate = chain
        .filter((entry) => childIds.indexOf(entry.id) < index)
        .map(({ id: retried, retries }) => hasFailedExactlyNTimes(retried, retries));
      return gate.length > 0
        ? parenthesis([...gate, achievedFormula(id)].join(separator('and')))
        : achievedFormula(id);
    });
  }
  const sentence = parenthesis(terms.join(separator(isAnd(goal) ? 'and' : 'or')));
  return `formula ${achievedFormula(goal.id)} = ${sentence};`;
};

/**
 * Achievability formula:
 *   AND:     G0_achievable = g0_achieved ? 0 : 1 * (!g1_achieved ? G1_achievable : 1) * …
 *            (remaining achievability: already achieved children no longer count)
 *   OR:      G0_achievable = G1_achievable + G2_achievable - (G1_achievable * G2_achievable)
 *   choice:  G0_achievable = g0_chosen=1 ? G1_achievable : … : <OR formula>
 * The OR formula follows the EDGE reference (sum minus product of all children).
 */
export const achievableGoalFormula = (goal: EdgeGoalNode): string => {
  const logger = getLogger();
  const childIds = orderedChildIds(goal);
  const formulaName = achievableFormulaVariable(goal.id);
  if (childIds.length === 0) {
    throw new Error(
      `Expected at least one child for goal ${goal.id} but children array is empty`,
    );
  }
  const achievables = childIds.map(achievableFormulaVariable);

  let type: 'AND' | 'OR' | 'SINGLE_GOAL';
  let value: string;
  if (isAnd(goal)) {
    type = 'AND';
    const remaining = childIds
      .map((id) => `(!${achievedFormula(id)} ? ${achievableFormulaVariable(id)} : 1)`)
      .join(' * ');
    value = `${achievedFormula(goal.id)} ? 0 : ${remaining}`;
  } else {
    type = 'OR';
    const orValue =
      achievables.length === 1
        ? achievables.join('')
        : `${achievables.join(' + ')} - ${parenthesis(achievables.join(' * '))}`;
    value = orValue;
    if (construct(goal) === 'choice') {
      const chosen = chosenVariable(goal.id);
      value =
        achievables.map((a, index) => `${chosen}=${index + 1} ? ${a} : `).join('') +
        parenthesis(orValue);
    }
  }

  const formula = `formula ${formulaName} = ${value};`;
  logger.achievabilityFormulaDefinition(goal.id, formulaName, type, value, formula);
  return formula;
};

/**
 * AND anyOrder: each child's share among the siblings that are not achieved yet
 *   formula G1_relative = g1_achieved ? 0 : G1_achievable/(G1_achievable + (g2_achieved ? 0 : G2_achievable));
 */
export const relativeFormulas = (goal: EdgeGoalNode): string => {
  if (construct(goal) !== 'anyOrder') {
    return '';
  }
  const childIds = orderedChildIds(goal);
  return childIds
    .map((id) => {
      const others = childIds
        .filter((other) => other !== id)
        .map((other) => ` + (${achievedFormula(other)} ? 0 : ${achievableFormulaVariable(other)})`)
        .join('');
      return `formula ${relativeFormulaVariable(id)} = ${achievedFormula(id)} ? 0 : ${achievableFormulaVariable(id)}/(${achievableFormulaVariable(id)}${others});`;
    })
    .join('\n');
};

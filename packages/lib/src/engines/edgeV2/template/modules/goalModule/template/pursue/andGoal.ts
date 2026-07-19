import { getLogger } from '../../../../../logger/logger';
import { parenthesis, separator } from '../../../../../mdp/common';
import { achievedFormula, stateVariable } from '../../../../../template/common';
import type { EdgeGoalNode } from '../../../../../types';
import {
  joinGuards,
  otherChildrenNotPursued,
  parentShouldPursue,
  selectChildByDecision,
} from './decisionGuards';

export const splitSequence = (
  sequence: string[],
  childId: string,
): [string[], string[]] => {
  if (!sequence.includes(childId)) {
    throw new Error(
      `Child ID ${childId} not found in sequence ${sequence.join(', ')}`,
    );
  }
  const sequenceIndex = sequence.indexOf(childId);
  return [sequence.slice(0, sequenceIndex), sequence.slice(sequenceIndex + 1)];
};

/**
 * AND + sequence (EDGEV2):
 *   G0_achievable*10.0 > decision_G0 [& g{prev}_achieved ...]
 */
export const pursueAndSequentialGoal = (
  goal: EdgeGoalNode,
  sequence: string[],
  childId: string,
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      'OR relation to children without a runtime notation is not supported use Degradation goal instead',
    );
  }

  const [leftGoals] = splitSequence(sequence, childId);

  if (!goal.relationToChildren) {
    return '';
  }

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, []);

  const priors =
    leftGoals.length > 0
      ? leftGoals.map((id) => achievedFormula(id)).join(separator('and'))
      : '';

  return joinGuards(parentShouldPursue(goal.id), priors);
};

/**
 * AND + anyOrder (EDGEV2):
 *   G0_achievable*10.0 > decision_G0
 *   & g{sibling}_state!=1
 *   & (g{sibling}_state=1 | ratio vs _decision_G0)
 *
 * Children may run in any order, but not concurrently; `_decision` picks who goes first.
 */
export const pursueAndAnyOrderGoal = (
  goal: EdgeGoalNode,
  anyOrder: string[],
  childId: string,
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      `Any-order goals are not supported for OR joints. Found in goal ${goal.id}`,
    );
  }

  if (!anyOrder.includes(childId)) {
    throw new Error(
      `Child ID ${childId} not found in anyOrder ${anyOrder.join(', ')}`,
    );
  }

  const { anyOrder: anyOrderLogger } = getLogger().pursue.executionDetail;
  anyOrderLogger(
    childId,
    anyOrder.filter((id) => id !== childId),
  );

  const siblings = anyOrder.filter((id) => id !== childId);
  const select = selectChildByDecision(goal.id, anyOrder, childId);

  if (siblings.length === 0) {
    return joinGuards(parentShouldPursue(goal.id), select);
  }

  const siblingPursued = siblings
    .map((id) => `${stateVariable(id)}=1`)
    .join(' | ');

  return joinGuards(
    parentShouldPursue(goal.id),
    otherChildrenNotPursued(anyOrder, childId),
    parenthesis(`${siblingPursued} | ${select}`),
  );
};

import { getLogger } from '../../../../../logger/logger';
import { separator } from '../../../../../mdp/common';
import { achievedFormula } from '../../../../../template/common';
import type { EdgeGoalNode } from '../../../../../types';
import {
  joinGuards,
  otherChildrenIdle,
  parentShouldPursue,
  selectChildByRelativeDecision,
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
 * AND + sequence (reference `fixed`):
 *   G0_achievable*N > decision_G0 & g{prev}_achieved … & g{other}_state=0 …
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

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, []);

  const priors = leftGoals.map((id) => achievedFormula(id)).join(separator('and'));

  return joinGuards(
    parentShouldPursue(goal.id),
    priors,
    otherChildrenIdle(sequence, childId),
  );
};

/**
 * AND + anyOrder (reference `flexible`): one child at a time, picked by its
 * share among the not-yet-achieved siblings (G*_relative) with priority to
 * earlier children:
 *   G0_achievable*N > decision_G0 & g{other}_state=0 …
 *   & G1_relative*N > _decision_G0 & !(G{earlier}_relative*N > _decision_G0) …
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

  return joinGuards(
    parentShouldPursue(goal.id),
    otherChildrenIdle(anyOrder, childId),
    selectChildByRelativeDecision(goal.id, anyOrder, childId),
  );
};

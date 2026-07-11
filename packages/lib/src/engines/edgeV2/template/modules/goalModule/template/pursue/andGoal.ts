import type { EdgeGoalNode } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import { separator } from '../../../../../mdp/common';
import { achievedFormula } from '../../../../../template/common';
import { joinGuards, parentShouldPursue } from './decisionGuards';

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

import { getLogger } from '../../../../logger/logger';
import { separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { beenAchieved } from './common';

export const pursueAndSequentialGoal = (
  goal: GoalNode,
  sequence: string[],
  childId: string
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      'OR relation to children without a runtime notation is not supported use Degradation goal instead'
    );
  }
  const sequenceIndex = sequence.indexOf(childId);
  const leftGoals = sequence.slice(0, sequenceIndex);
  const rightGoals = sequence.slice(sequenceIndex);

  if (!goal.relationToChildren) {
    return '';
  }

  const resolveAndGoal = (): string => {
    if (leftGoals.length === 0) {
      return beenAchieved(childId, { condition: false });
    }

    return [
      ...leftGoals.map((goal) => beenAchieved(goal, { condition: true })),
      ...rightGoals.map((goal) => beenAchieved(goal, { condition: false })),
    ].join(separator('and'));
  };

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, rightGoals);

  if (goal.relationToChildren === 'and') {
    return resolveAndGoal();
  }

  return '';
};

import { GoalNode } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { separator } from '../../../../mdp/common';
import { beenAchieved } from './common';

export const splitSequence = (
  sequence: string[],
  childId: string
): [string[], string[]] => {
  if (!sequence.includes(childId)) {
    throw new Error(
      `Child ID ${childId} not found in sequence ${sequence.join(', ')}`
    );
  }
  const sequenceIndex = sequence.indexOf(childId);
  return [sequence.slice(0, sequenceIndex), sequence.slice(sequenceIndex + 1)];
};

export const pursueAndSequentialGoal = (
  goal: GoalNode,
  sequence: string[],
  childId: string,
  children: GoalNode[]
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      'OR relation to children without a runtime notation is not supported use Degradation goal instead'
    );
  }

  const [leftGoals, rightGoals] = splitSequence(sequence, childId);

  if (!goal.relationToChildren) {
    return '';
  }
  const childrenMap = new Map<string, GoalNode>(
    children.map((child) => [child.id, child])
  );

  const resolveAndGoal = (): string => {
    if (leftGoals.length === 0) {
      return beenAchieved(childrenMap.get(childId)!, { condition: false });
    }

    return [
      ...leftGoals.map((goalId) =>
        beenAchieved(childrenMap.get(goalId)!, { condition: true })
      ),
      ...rightGoals.map((goalId) =>
        beenAchieved(childrenMap.get(goalId)!, { condition: false })
      ),
    ].join(separator('and'));
  };

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, rightGoals);

  if (goal.relationToChildren === 'and') {
    return resolveAndGoal();
  }

  return '';
};

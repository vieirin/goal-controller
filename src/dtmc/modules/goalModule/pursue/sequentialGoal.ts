import { separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { beenAchieved, beenAchievedAndPursued } from './common';

export const pursueSequentialGoal = (
  goal: GoalNode,
  sequence: string[],
  childId: string
): string => {
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

  const resolveOrGoal = () => {
    if (leftGoals.length === 0) {
      return rightGoals
        .map((goal) =>
          beenAchievedAndPursued(goal, {
            pursued: false,
            achieved: false,
          })
        )
        .join(separator('and'));
    }

    return leftGoals
      .map((goal) =>
        beenAchievedAndPursued(goal, {
          pursued: true,
          achieved: false,
        })
      )
      .join(separator('and'));
  };

  if (goal.relationToChildren === 'and') {
    return resolveAndGoal();
  }

  if (goal.relationToChildren === 'or') {
    return resolveOrGoal();
  }

  return '';
};

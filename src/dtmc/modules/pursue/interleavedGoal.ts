import { separator } from '../../../mdp/common';
import { GoalNode } from '../../../ObjectiveTree/types';
import { beenPursued } from './common';

export const pursueInterleavedGoal = (
  goal: GoalNode,
  interleaved: string[],
  currentChildId: string
) => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Interleaved goals are not supported for and joints. Found in goal ${goal.id}`
    );
  }
  console.log(goal.executionDetail);
  if (goal.relationToChildren === 'or') {
    const otherGoals = interleaved.filter(
      (goalId) => goalId !== currentChildId
    );
    return otherGoals
      .map((goalId) => {
        return beenPursued(goalId, { condition: false });
      })
      .join(separator('and'));
  }

  return '';
};

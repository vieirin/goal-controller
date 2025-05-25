import { pursued, separator } from '../../../../mdp/common';
import type { GoalNodeWithParent } from '../../../../ObjectiveTree/types';

const childrenHasNotBeenPursued = (children: GoalNodeWithParent[]) => {
  return children
    .map((child) => `${pursued(child.id)}=0`)
    .join(separator('and'));
};

export const skipStatement = (goal: GoalNodeWithParent) => {
  return `[skip_${goal.id}] ${pursued(goal.id)}=1 & ${childrenHasNotBeenPursued(
    goal.children ?? []
  )} -> (${pursued(goal.id)}'=0);`;
};

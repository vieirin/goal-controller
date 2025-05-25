import { pursued, separator } from '../../../../mdp/common';
import type { GoalNodeWithParent } from '../../../../ObjectiveTree/types';

const childrenHasNotBeenPursued = (goal: GoalNodeWithParent) => {
  const pursueMembers = goal.children?.length
    ? goal.children
    : goal.tasks?.length
    ? goal.tasks
    : [];

  return pursueMembers
    .map((child) => `${pursued(child.id)}=0`)
    .join(separator('and'));
};

export const skipStatement = (goal: GoalNodeWithParent) => {
  return `[skip_${goal.id}] ${pursued(goal.id)}=1 & ${childrenHasNotBeenPursued(
    goal
  )} -> (${pursued(goal.id)}'=0);`;
};

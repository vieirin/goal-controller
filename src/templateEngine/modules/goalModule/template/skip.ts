import type { GoalNode } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { pursued, separator } from '../../../../mdp/common';

const childrenHasNotBeenPursued = (goal: GoalNode) => {
  const pursueMembers = goal.children?.length
    ? goal.children
    : goal.tasks?.length
    ? goal.tasks
    : [];

  return pursueMembers
    .map((child) => `${pursued(child.id)}=0`)
    .join(separator('and'));
};

export const skipStatement = (goal: GoalNode) => {
  const logger = getLogger();
  const leftStatement = `${pursued(goal.id)}=1 & ${childrenHasNotBeenPursued(
    goal
  )}`;
  const updateStatement = `(${pursued(goal.id)}'=0);`;
  const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

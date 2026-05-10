import type { TreeNode } from '@goal-controller/goal-tree';
import type { EdgeGoalNode } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import { goalState, pursued, separator } from '../../../../mdp/common';

const childNotPursued = (child: TreeNode): string =>
  child.type === 'task' ? `${pursued(child.id)}=0` : `${goalState(child.id)}=0`;

const childrenHasNotBeenPursued = (goal: EdgeGoalNode) => {
  const pursueMembers: TreeNode[] = goal.children?.length
    ? goal.children
    : goal.tasks?.length
      ? goal.tasks
      : [];

  return pursueMembers
    .map((child: TreeNode) => childNotPursued(child))
    .join(separator('and'));
};

export const skipStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();
  const leftStatement = `${goalState(goal.id)}=1 & ${childrenHasNotBeenPursued(
    goal,
  )}`;
  const updateStatement = `(${goalState(goal.id)}'=0);`;
  const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

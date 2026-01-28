import type { GoalNode, Relation } from '@goal-controller/goal-tree';
import { childrenIncludingTasks } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import { achieved, pursued, separator } from '../../../../mdp/common';
import { achievedVariable } from '../../../common';
import { achievedMaintain } from './formulas';
import { hasBeenPursued } from './pursue/common';

const isValidSeparator = (
  relation: Relation | null,
): relation is 'and' | 'or' => {
  return ['and', 'or'].includes(relation ?? '');
};

export const achieveCondition = (goal: GoalNode): string => {
  if (isValidSeparator(goal.relationToChildren)) {
    const children = childrenIncludingTasks({ node: goal });
    if (children.length) {
      return `(${children
        .map((child) =>
          child.properties.edge.execCondition?.maintain
            ? `${achievedMaintain(child.id)}=true`
            : `${achievedVariable(child.id)}=1`,
        )
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

export const achieveStatement = (goal: GoalNode): string => {
  const logger = getLogger();

  const leftStatement = [
    hasBeenPursued(goal, { condition: true }),
    achieveCondition(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const achievedUpdate = `${achieved(goal.id)}'=1`;
  const shouldHaveUpdateAchieved =
    !goal.properties.edge.execCondition?.maintain;
  const updateStatement = `(${pursued(goal.id)}'=0)${
    shouldHaveUpdateAchieved ? ` & (${achievedUpdate})` : ''
  };`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

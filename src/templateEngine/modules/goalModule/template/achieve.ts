import type { GoalNode, Relation } from '../../../../GoalTree/types';
import { childrenIncludingTasks } from '../../../../GoalTree/utils';
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

export const achieveCondition = (goal: GoalNode) => {
  if (isValidSeparator(goal.relationToChildren)) {
    const children = childrenIncludingTasks({ node: goal });
    if (children.length) {
      return `(${children
        .map((child) =>
          child.execCondition?.maintain
            ? `${achievedMaintain(child.id)}=true`
            : `${achievedVariable(child.id)}=1`,
        )
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

export const achieveStatement = (goal: GoalNode) => {
  const logger = getLogger();

  const leftStatement = [
    hasBeenPursued(goal, { condition: true }),
    achieveCondition(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const achievedUpdate = `${achieved(goal.id)}'=1`;
  const shouldHaveUpdateAchieved = goal.execCondition?.maintain ? false : true;
  const updateStatement = `(${pursued(goal.id)}'=0)${
    shouldHaveUpdateAchieved ? ` & (${achievedUpdate})` : ''
  };`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

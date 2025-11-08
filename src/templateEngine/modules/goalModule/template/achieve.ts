import { GoalNodeWithParent, Relation } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { achieved, pursued, separator } from '../../../../mdp/common';
import { achievedVariable } from '../../../common';
import { achievedMaintain } from './formulas';
import { beenPursued } from './pursue/common';

const isValidSeparator = (
  relation: Relation | null
): relation is 'and' | 'or' => {
  return ['and', 'or'].includes(relation ?? '');
};

const achieveCondition = (goal: GoalNodeWithParent) => {
  if (isValidSeparator(goal.relationToChildren)) {
    const children = [...(goal.children || []), ...(goal.tasks || [])];
    if (children.length) {
      return `(${children
        .map((child) =>
          child.execCondition?.maintain
            ? `${achievedMaintain(child.id)}=true`
            : `${achievedVariable(child.id)}=1`
        )
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

export const achieveStatement = (goal: GoalNodeWithParent) => {
  const logger = getLogger();

  const leftStatement = [
    beenPursued(goal, { condition: true }),
    achieveCondition(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const updateStatement = `(${pursued(goal.id)}'=0) & (${achieved(
    goal.id
  )}'=1);`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

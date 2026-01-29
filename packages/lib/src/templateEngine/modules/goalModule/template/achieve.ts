import type { Relation } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../edgeTypes';
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

export const achieveCondition = (goal: EdgeGoalNode): string => {
  if (isValidSeparator(goal.relationToChildren)) {
    // Filter out resources first, then check if there are any pursueable children
    const pursueableChildren = Node.children(goal).filter(
      (child) => !Node.isResource(child),
    );
    if (pursueableChildren.length) {
      return `(${pursueableChildren
        .map((child) => {
          const typedChild = child as EdgeGoalNode | EdgeTask;
          return typedChild.properties.engine.execCondition?.maintain
            ? `${achievedMaintain(typedChild.id)}=true`
            : `${achievedVariable(typedChild.id)}=1`;
        })
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

export const achieveStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();

  const leftStatement = [
    hasBeenPursued(goal, { condition: true }),
    achieveCondition(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const achievedUpdate = `${achieved(goal.id)}'=1`;
  const shouldHaveUpdateAchieved =
    !goal.properties.engine.execCondition?.maintain;
  const updateStatement = `(${pursued(goal.id)}'=0)${
    shouldHaveUpdateAchieved ? ` & (${achievedUpdate})` : ''
  };`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

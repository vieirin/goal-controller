import type { Relation } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import {
  achieved,
  goalState,
  pursued,
  separator,
} from '../../../../mdp/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
import { achievedMaintain } from './formulas';
import { hasBeenPursued } from './pursue/common';

const isValidSeparator = (
  relation: Relation | null,
): relation is 'and' | 'or' => {
  return ['and', 'or'].includes(relation ?? '');
};

const childIdle = (child: EdgeGoalNode | EdgeTask): string =>
  child.type === 'task' ? `${pursued(child.id)}=0` : `${goalState(child.id)}=0`;

export const achieveCondition = (goal: EdgeGoalNode): string => {
  if (!isValidSeparator(goal.relationToChildren)) {
    return '';
  }
  const pursueableChildren = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  );
  if (!pursueableChildren.length) {
    return '';
  }
  return pursueableChildren
    .map((child) => childIdle(child as EdgeGoalNode | EdgeTask))
    .join(' & ');
};

export const achieveStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();

  const achievedGuard = goal.properties.engine.execCondition?.maintain
    ? `${achievedMaintain(goal.id)}=true`
    : `${achieved(goal.id)}`;

  const cond = achieveCondition(goal);
  const leftStatement = [
    hasBeenPursued(goal, { condition: true }),
    achievedGuard,
    cond,
  ]
    .filter(Boolean)
    .join(separator('and'));

  const updateStatement = `(${goalState(goal.id)}'=0);`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

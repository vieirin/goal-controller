import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import { separator } from '../../../../mdp/common';
import {
  achievedFormula,
  pursuedVariable,
  stateVariable,
} from '../../../../template/common';

/** Child idle: goals use g*_state=0; tasks still use T*_pursued=0 */
const childIdle = (child: EdgeGoalNode | EdgeTask): string =>
  Node.isTask(child)
    ? `${pursuedVariable(child.id)}=0`
    : `${stateVariable(child.id)}=0`;

const childrenIdle = (goal: EdgeGoalNode): string => {
  const children = Node.children(goal).filter(
    (child): child is EdgeGoalNode | EdgeTask => !Node.isResource(child),
  );
  if (children.length === 0) {
    return '';
  }
  return children.map(childIdle).join(separator('and'));
};

/**
 * EDGEV2 (base; decision thresholds may be added later):
 *   [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g2_state=0 -> (g0_state'=0);
 */
export const skipStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();
  const leftStatement = [
    `!${achievedFormula(goal.id)}`,
    `${stateVariable(goal.id)}=1`,
    childrenIdle(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));
  const updateStatement = `(${stateVariable(goal.id)}'=0);`;
  const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

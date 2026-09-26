import type { EdgeGoalNode } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import { separator } from '../../../../mdp/common';
import { achievedFormula, stateVariable } from '../../../../template/common';
import { orderedChildIds } from './children';

const childrenIdle = (goal: EdgeGoalNode): string =>
  orderedChildIds(goal)
    .map((id) => `${stateVariable(id)}=0`)
    .join(separator('and'));

/**
 * EDGEV2:
 *   [achieved_G0] g0_state=1 & g0_achieved & g1_state=0 & g2_state=0 -> (g0_state'=0);
 */
export const achieveStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();

  const leftStatement = [
    `${stateVariable(goal.id)}=1`,
    achievedFormula(goal.id),
    childrenIdle(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const updateStatement = `(${stateVariable(goal.id)}'=0);`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalTree } from '../types';
import { decisionVariable } from './common';
import { goalNumberId } from './modules/goalModule/goalModules';

/**
 * Uninterpreted decision constants at the top of the model (PRISM
 * `const int decision_<goalId>;`, same idea as the Edge engine’s top-level
 * decision constants).
 */
export const decisionVariablesTemplate = ({
  gm,
}: {
  gm: EdgeGoalTree;
}): string => {
  const goals = GoalTree.allByType(gm, 'goal');
  return goals
    .sort((a, b) => Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)))
    .map((g) => `const int ${decisionVariable(g.id)};`)
    .join('\n');
};

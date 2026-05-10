import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalTree } from '../types';
import { decisionVariable, underscoredOrDecisionVariable } from './common';
import { goalNumberId } from './modules/goalModule/goalModules';

/**
 * Uninterpreted decision constants after `dtmc`: every goal gets
 * `decision_<id>`; OR goals also get `_decision_<id>` (snippet tie-break).
 */
export const decisionVariablesTemplate = ({
  gm,
}: {
  gm: EdgeGoalTree;
}): string => {
  const goals = GoalTree.allByType(gm, 'goal');
  return goals
    .sort((a, b) => Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)))
    .flatMap((g) => {
      const lines = [`const int ${decisionVariable(g.id)};`];
      if (g.relationToChildren === 'or') {
        lines.push(`const int ${underscoredOrDecisionVariable(g.id)};`);
      }
      return lines;
    })
    .join('\n');
};

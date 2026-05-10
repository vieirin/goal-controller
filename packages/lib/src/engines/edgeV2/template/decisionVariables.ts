import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalTree } from '../types';
import { decisionVariable, underscoredOrDecisionVariable } from './common';
import { goalNumberId } from './modules/goalModule/goalModules';

/**
 * Uninterpreted decision constants after `dtmc`: every goal gets
 * `decision_<id>`; OR goals also get `_decision_<id>` (snippet tie-break);
 * every task gets `decision_<id>` for child pursue thresholds under basic AND.
 */
export const decisionVariablesTemplate = ({
  gm,
}: {
  gm: EdgeGoalTree;
}): string => {
  const goals = GoalTree.allByType(gm, 'goal');
  const tasks = GoalTree.allByType(gm, 'task');

  const goalLines = goals
    .sort((a, b) => Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)))
    .flatMap((g) => {
      const lines = [`const int ${decisionVariable(g.id)};`];
      if (g.relationToChildren === 'or') {
        lines.push(`const int ${underscoredOrDecisionVariable(g.id)};`);
      }
      return lines;
    });

  const taskLines = tasks
    .sort((a, b) => Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)))
    .map((t) => `const int ${decisionVariable(t.id)};`);

  return [...goalLines, ...taskLines].join('\n');
};

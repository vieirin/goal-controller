import type { GoalTreeType } from '@goal-controller/goal-tree';
import { GoalTree } from '@goal-controller/goal-tree';
import { generateDefinitions } from './definitions';
import { generatePurposes } from './purposes';
import { generateTaskRules } from './rules';
import type { SleecGoalProps, SleecTaskProps } from '../types';

// Re-export types and utilities
export { extractMeasures } from './definitions';
export type { Measure, MeasureType } from './shared';

export const sleecTemplateEngine = (
  tree: GoalTreeType<SleecGoalProps, SleecTaskProps>,
): string => {
  const tasks = GoalTree.allByType(tree, 'task');
  const definitions = generateDefinitions(tasks);
  const rules = generateTaskRules(tasks);
  const purposes = generatePurposes(tree);
  return `${definitions}

${rules}

${purposes}`;
};


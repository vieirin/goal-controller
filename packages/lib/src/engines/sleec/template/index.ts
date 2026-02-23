import type { GoalTreeType } from '@goal-controller/goal-tree';
import { GoalTree } from '@goal-controller/goal-tree';
import { generateDefinitions } from './definitions';
import { generatePurposes } from './purposes';
import { generateTaskRules } from './rules';
import type { SleecGoalProps, SleecTaskProps } from '../types';

// Re-export types and utilities
export { extractMeasures } from './definitions';
export type { Measure, MeasureType } from './shared';

export type SleecTemplateOptions = {
  /** Whether to generate fluent definitions. Defaults to true. */
  generateFluents?: boolean;
};

export const sleecTemplateEngine = (
  tree: GoalTreeType<SleecGoalProps, SleecTaskProps>,
  options: SleecTemplateOptions = {},
): string => {
  const { generateFluents = true } = options;
  const tasks = GoalTree.allByType(tree, 'task');
  const definitions = generateDefinitions(tasks, { generateFluents });
  const rules = generateTaskRules(tasks);
  const purposes = generatePurposes(tree);
  return `${definitions}

${rules}

${purposes}`;
};

import type { GoalTree } from '@goal-controller/goal-tree';
import { allByType } from '@goal-controller/goal-tree';
import { generateDefinitions } from './definitions';
import { generatePurposes } from './purposes';
import { generateTaskRules } from './rules';

// Re-export types and utilities
export { extractMeasures } from './definitions';
export type { Measure, MeasureType } from './shared';

export const sleecTemplateEngine = (tree: GoalTree): string => {
  const tasks = allByType({ gm: tree, type: 'task' });
  const definitions = generateDefinitions(tasks);
  const rules = generateTaskRules(tasks);
  const purposes = generatePurposes(tree);
  return `${definitions}

${rules}

${purposes}`;
};

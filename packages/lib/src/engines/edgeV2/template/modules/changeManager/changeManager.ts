import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalTree } from '../../../types';
import { getLogger } from '../../../logger/logger';
import { changeManagerModuleTemplate } from './template';
import { taskAchievabilityVariables } from './template/achievabilityVariables/taskAchievabilityVariables';

export const changeManagerModule = ({
  gm,
  variables,
}: {
  gm: EdgeGoalTree;
  variables: Record<string, boolean | number>;
}): string => {
  const tasks = GoalTree.allByType(gm, 'task');
  const logger = getLogger();
  logger.info('[CHANGE MANAGER MODULE START]', 0);

  // Filter to only include number values (task achievability variables)
  const numericVariables = Object.fromEntries(
    Object.entries(variables).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>;

  return (
    taskAchievabilityVariables(tasks, numericVariables) +
    '\n\n' +
    changeManagerModuleTemplate({ tasks })
  );
};

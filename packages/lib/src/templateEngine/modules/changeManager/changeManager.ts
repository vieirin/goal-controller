import { readFileSync } from 'fs';
import { getVariablesFilePath } from '../../../utils/variablesPath';
import { getTaskAchievabilityVariables } from '@goal-controller/goal-tree';
import type { GoalTree, Task } from '@goal-controller/goal-tree';
import { allByType } from '@goal-controller/goal-tree';
import { getLogger } from '../../../logger/logger';
import { changeManagerModuleTemplate } from './template';
import { taskAchievabilityVariables } from './template/achievabilityVariables/taskAchievabilityVariables';

export const changeManagerModule = ({
  gm,
  fileName,
  variables,
}: {
  gm: GoalTree;
  fileName: string;
  variables?: Record<string, boolean | number>;
}): string => {
  const tasks = allByType({ gm, type: 'task' });
  const logger = getLogger();
  logger.info('[CHANGE MANAGER MODULE START]', 0);
  const taskAchieveVariables = getTaskAchievabilityVariables(gm);

  // If variables are provided directly, use them; otherwise try to read from file
  if (variables) {
    // Filter to only include number values (task achievability variables)
    const numericVariables = Object.fromEntries(
      Object.entries(variables).filter(
        ([, value]) => typeof value === 'number',
      ),
    ) as Record<string, number>;
    return (
      taskAchievabilityVariables(tasks, numericVariables) +
      '\n\n' +
      changeManagerModuleTemplate({ tasks })
    );
  }

  try {
    const variablesFilePath = getVariablesFilePath(fileName);
    const defaultVariableValues =
      taskAchieveVariables.length > 0
        ? JSON.parse(readFileSync(variablesFilePath, 'utf8'))
        : {};
    return (
      taskAchievabilityVariables(tasks, defaultVariableValues) +
      '\n\n' +
      changeManagerModuleTemplate({ tasks })
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading variables file:', error);
    throw new Error('Error reading variables file');
  }
};

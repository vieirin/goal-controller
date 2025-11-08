import { readFileSync } from 'fs';
import { getVariablesFilePath } from '../../../cli/menu/variablesInput';
import { getTaskAchievabilityVariables } from '../../../GoalTree/treeVariables';
import type { GoalTreeWithParent } from '../../../GoalTree/types';
import { allByType } from '../../../GoalTree/utils';
import { getLogger } from '../../../logger/logger';
import { changeManagerModuleTemplate } from './template';
import { taskAchievabilityVariables } from './template/achievabilityVariables/taskAchievabilityVariables';

export const changeManagerModule = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  const tasks = allByType({ gm, type: 'task' });
  const logger = getLogger();
  logger.info('[CHANGE MANAGER MODULE START]', 0);
  const taskAchieveVariables = getTaskAchievabilityVariables(gm);

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
    console.error('Error reading variables file:', error);
    throw new Error('Error reading variables file');
  }
};

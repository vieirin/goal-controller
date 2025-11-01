import type { GoalTreeWithParent } from '../../../GoalTree/types';
import { allByType } from '../../../GoalTree/utils';
import { getLogger } from '../../../logger/logger';
import { changeManagerModuleTemplate } from './template';

export const changeManagerModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const tasks = allByType({ gm, type: 'task' });
  const logger = getLogger();
  logger.info('[CHANGE MANAGER MODULE START]', 0);

  return changeManagerModuleTemplate({ tasks });
};

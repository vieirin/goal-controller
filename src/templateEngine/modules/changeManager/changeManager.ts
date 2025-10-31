import type { GoalTreeWithParent } from '../../../GoalTree/types';
import { allByType } from '../../../GoalTree/utils';
import { getLogger } from '../../../logger/logger';
import { taskTransitions, taskVariables } from './tasks';

export const changeManagerModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const tasks = allByType({ gm, type: 'task' });
  const logger = getLogger();
  logger.info('[CHANGE MANAGER MODULE START]', 0);
  const { variables, transitions } = tasks.reduce(
    (acc, task) => {
      acc.variables.push(taskVariables(task));
      acc.transitions.push(taskTransitions(task));
      return acc;
    },
    { variables: [] as string[], transitions: [] as string[] }
  );

  return `module ChangeManager
  ${variables.join('\n')}
  ${transitions.join('\n')}
endmodule`;
};

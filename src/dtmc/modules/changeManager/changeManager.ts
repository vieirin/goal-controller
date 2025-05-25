import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';
import { taskTransitions, taskVariables } from './tasks';

export const changeManagerModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const tasks = allByType({ gm, type: 'task' });
  return `module ChangeManager
  ${tasks.map(taskVariables).join('')}
  ${tasks.map(taskTransitions).join('')}
endmodule`;
};

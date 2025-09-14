import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';
import { taskTransitions, taskVariables } from './tasks';

export const changeManagerModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const tasks = allByType({ gm, type: 'task' });

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

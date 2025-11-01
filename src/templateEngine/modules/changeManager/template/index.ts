import type { GoalNode } from '../../../../GoalTree/types';
import { taskTransitions, taskVariables } from './tasks';

export const changeManagerModuleTemplate = ({
  tasks,
}: {
  tasks: GoalNode[];
}) => {
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

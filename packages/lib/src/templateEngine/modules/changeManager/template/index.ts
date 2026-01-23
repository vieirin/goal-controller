import type { GoalNode } from '../../../../GoalTree/types';
import { taskTransitions } from './tasks/transitions';
import { taskVariables } from './tasks/variables';

export const changeManagerModuleTemplate = ({
  tasks,
}: {
  tasks: GoalNode[];
}): string => {
  const { variables, transitions } = tasks.reduce(
    (acc, task) => {
      acc.variables.push(taskVariables(task));
      acc.transitions.push(taskTransitions(task));
      return acc;
    },
    { variables: [] as string[], transitions: [] as string[] },
  );

  return `module ChangeManager
  ${variables.join('\n  ')}
  ${transitions.join('\n')}
endmodule`;
};

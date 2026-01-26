import { achievableFormulaVariable } from '../templateEngine/common';
import type { GoalTree } from './types';
import { allByType } from './utils';

const getTreeContextVariables = (tree: GoalTree): string[] => {
  const variables = new Set<string>();

  const goals = allByType({ gm: tree, type: 'goal' });
  const tasks = allByType({ gm: tree, type: 'task' });

  // Collect variables from goals
  goals.forEach((goal) => {
    goal.execCondition?.maintain?.variables.forEach((variable) => {
      variables.add(variable.name);
    });

    goal.execCondition?.assertion?.variables.forEach((variable) => {
      variables.add(variable.name);
    });
  });

  // Collect variables from tasks (tasks can also have assertions)
  tasks.forEach((task) => {
    task.execCondition?.assertion?.variables.forEach((variable) => {
      variables.add(variable.name);
    });
  });

  return Array.from(variables);
};

export const getTaskAchievabilityVariables = (tree: GoalTree): string[] => {
  const tasks = allByType({ gm: tree, type: 'task' });
  const taskAchievabilityVariables = tasks.map((task) =>
    achievableFormulaVariable(task.id),
  );
  return taskAchievabilityVariables;
};
export { getTreeContextVariables as treeContextVariables };

import type { GoalTree } from './types';
import { allByType } from './utils';

// Helper function for achievable formula variable names
const achievableFormulaVariable = (goalId: string): string =>
  `${goalId}_achievable`;

const getTreeContextVariables = (tree: GoalTree): string[] => {
  const variables = new Set<string>();

  const goals = allByType({ gm: tree, type: 'goal' });
  const tasks = allByType({ gm: tree, type: 'task' });

  // Collect variables from goals
  goals.forEach((goal) => {
    if (goal.properties?.edge?.execCondition?.maintain?.variables) {
      goal.properties.edge.execCondition.maintain.variables.forEach(
        (variable) => {
          variables.add(variable.name);
        },
      );
    }

    if (goal.properties?.edge?.execCondition?.assertion?.variables) {
      goal.properties.edge.execCondition.assertion.variables.forEach(
        (variable) => {
          variables.add(variable.name);
        },
      );
    }
  });

  // Collect variables from tasks (tasks can also have assertions)
  tasks.forEach((task) => {
    if (task.properties?.edge?.execCondition?.assertion?.variables) {
      task.properties.edge.execCondition.assertion.variables.forEach(
        (variable) => {
          variables.add(variable.name);
        },
      );
    }
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

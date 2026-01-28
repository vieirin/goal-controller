/**
 * Internal tree variable utilities
 */
import type { GoalTree } from '../types/';
import { allByType } from './traversal';

const achievableFormulaVariable = (goalId: string): string =>
  `${goalId}_achievable`;

export function getContextVariables(tree: GoalTree): string[] {
  const variables = new Set<string>();

  const goals = allByType(tree, 'goal');
  const tasks = allByType(tree, 'task');

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
}

export function getTaskAchievabilityVariables(tree: GoalTree): string[] {
  const tasks = allByType(tree, 'task');
  return tasks.map((task) => achievableFormulaVariable(task.id));
}

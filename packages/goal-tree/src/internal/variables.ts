/**
 * Internal tree variable utilities
 */
import type { GoalTree } from '../types/';
import { allByType } from './traversal';

const achievableFormulaVariable = (goalId: string): string =>
  `${goalId}_achievable`;

/**
 * Get context variables from a tree array.
 * Works with any engine type - returns empty array if engine doesn't have execCondition.
 */
export function getContextVariables<TGoalEngine, TTaskEngine, TResourceEngine>(
  tree: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
): string[] {
  const variables = new Set<string>();

  const goals = allByType(tree, 'goal');
  const tasks = allByType(tree, 'task');

  // Collect variables from goals (safely access potentially missing properties)
  goals.forEach((goal) => {
    const engine = goal.properties?.engine as
      | {
          execCondition?: {
            maintain?: { variables: Array<{ name: string }> };
            assertion?: { variables: Array<{ name: string }> };
          };
        }
      | undefined;

    if (engine?.execCondition?.maintain?.variables) {
      engine.execCondition.maintain.variables.forEach((variable) => {
        variables.add(variable.name);
      });
    }

    if (engine?.execCondition?.assertion?.variables) {
      engine.execCondition.assertion.variables.forEach((variable) => {
        variables.add(variable.name);
      });
    }
  });

  // Collect variables from tasks (tasks can also have assertions)
  tasks.forEach((task) => {
    const engine = task.properties?.engine as
      | {
          execCondition?: {
            assertion?: { variables: Array<{ name: string }> };
          };
        }
      | undefined;

    if (engine?.execCondition?.assertion?.variables) {
      engine.execCondition.assertion.variables.forEach((variable) => {
        variables.add(variable.name);
      });
    }
  });

  return Array.from(variables);
}

export function getTaskAchievabilityVariables<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
>(tree: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>): string[] {
  const tasks = allByType(tree, 'task');
  return tasks.map((task) => achievableFormulaVariable(task.id));
}

import type { GoalTreeWithParent } from './types';
import { allByType } from './utils';

const treeVariables = (tree: GoalTreeWithParent) => {
  const variables = new Set<string>();

  const goals = allByType({ gm: tree, type: 'goal' });

  goals.forEach((goal) => {
    goal.maintainCondition?.maintain.variables.forEach((variable) => {
      variables.add(variable.name);
    });

    goal.maintainCondition?.assertion.variables.forEach((variable) => {
      variables.add(variable.name);
    });
  });

  return Array.from(variables);
};

export { treeVariables };

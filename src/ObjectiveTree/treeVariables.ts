import type { GoalTreeWithParent } from './types';
import { allByType } from './utils';

const getTreeVariables = (tree: GoalTreeWithParent) => {
  const variables = new Set<string>();

  const goals = allByType({ gm: tree, type: 'goal' });
  const resources = allByType({ gm: tree, type: 'resource' });

  resources.forEach((resource) => {
    if (resource.name) {
      const sanitizedName = resource.name
        .toLocaleLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '_');
      const variableName = `resource_${sanitizedName}`;
      variables.add(variableName);
    } else {
      throw new Error('Resource name is required');
    }
  });

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

export { getTreeVariables as treeVariables };

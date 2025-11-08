import type { GoalNode } from '../../../../../GoalTree/types';
import { achievableFormulaVariable } from '../../../../common';

export const taskAchievabilityVariable = (
  task: GoalNode,
  variableValues: Record<string, number>
) => {
  const variableName = achievableFormulaVariable(task.id);
  const variableValue = variableValues[variableName];
  return `const double ${variableName} = ${variableValue};`;
};

export const taskAchievabilityVariables = (
  tasks: GoalNode[],
  variableValues: Record<string, number>
) => {
  return tasks
    .map((task) => taskAchievabilityVariable(task, variableValues))
    .join('\n');
};

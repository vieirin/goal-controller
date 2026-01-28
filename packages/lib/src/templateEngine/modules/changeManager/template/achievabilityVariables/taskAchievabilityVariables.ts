import type { Task } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import { achievableFormulaVariable } from '../../../../common';

export const taskAchievabilityVariable = (
  task: Task,
  variableValues: Record<string, number>,
): string => {
  const logger = getLogger();
  const variableName = achievableFormulaVariable(task.id);
  const variableValue = variableValues[variableName];
  if (!variableValue) {
    throw new Error(
      `Variable value not found for task ${task.id}: ${variableName}`,
    );
  }
  const achievabilityConst = `const double ${variableName} = ${variableValue};`;
  logger.achievabilityTaskConstant(task.id, variableName, variableValue);

  return achievabilityConst;
};

export const taskAchievabilityVariables = (
  tasks: Task[],
  variableValues: Record<string, number>,
): string => {
  return tasks
    .map((task) => taskAchievabilityVariable(task, variableValues))
    .join('\n');
};

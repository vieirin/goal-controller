import type { Task } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import { achievableFormulaVariable } from '../../../../../template/common';

const DEFAULT_ACHIEVABILITY = 0.5;

export const taskAchievabilityVariable = (
  task: Task,
  variableValues: Record<string, number>,
): string => {
  const logger = getLogger();
  const variableName = achievableFormulaVariable(task.id);
  const variableValue = variableValues[variableName] ?? DEFAULT_ACHIEVABILITY;
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

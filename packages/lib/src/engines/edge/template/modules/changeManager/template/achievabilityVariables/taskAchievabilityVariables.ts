import type { EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import { achievableFormulaVariable } from '../../../../../template/common';

const DEFAULT_ACHIEVABILITY = 0.5;

export const taskAchievabilityVariable = (
  task: EdgeTask,
  variableValues: Record<string, number>,
): string => {
  const logger = getLogger();
  const variableName = achievableFormulaVariable(task.id);

  // Check if variable is explicitly configured or using default
  const isConfigured = variableName in variableValues;
  const variableValue = isConfigured
    ? variableValues[variableName]
    : DEFAULT_ACHIEVABILITY;

  if (!isConfigured) {
    logger.info(
      `[WARNING] Task ${task.id}: using default achievability ${DEFAULT_ACHIEVABILITY} for ${variableName} (not configured in variables file)`,
      0,
    );
  }

  const achievabilityConst = `const double ${variableName} = ${variableValue};`;
  logger.achievabilityTaskConstant(task.id, variableName, variableValue ?? -1);

  return achievabilityConst;
};

export const taskAchievabilityVariables = (
  tasks: EdgeTask[],
  variableValues: Record<string, number>,
): string => {
  return tasks
    .map((task) => taskAchievabilityVariable(task, variableValues))
    .join('\n');
};

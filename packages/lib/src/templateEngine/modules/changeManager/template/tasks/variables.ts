import type { EdgeTask } from '../../../../edgeTypes';
import { getLogger } from '../../../../../logger/logger';
import { achievedVariable, failed, pursuedVariable } from '../../../../common';

const defineVariable = (variable: string): string => {
  const upperBound = 1;

  const logger = getLogger();
  logger.variableDefinition({
    variable,
    upperBound,
    initialValue: 0,
    type: 'int',
    context: 'task',
  });
  return `${variable}: [0..${upperBound}] init 0;`;
};

export const maxRetriesVariable = (task: EdgeTask): string => {
  const maxRetries = task.properties.engine.maxRetries;
  if (maxRetries === 0) {
    return '';
  }
  const logger = getLogger();

  logger.variableDefinition({
    variable: failed(task.id),
    upperBound: maxRetries,
    initialValue: 0,
    type: 'int',
    context: 'task',
  });
  return `${failed(task.id)}: [0..${maxRetries}] init 0;`;
};

export const taskVariables = (task: EdgeTask): string => {
  const logger = getLogger();
  logger.initTask(task);

  return `
  ${defineVariable(pursuedVariable(task.id))}
  ${defineVariable(achievedVariable(task.id))}
`.trim();
};

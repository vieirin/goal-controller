import type { EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import {
  achievedFormula,
  stateVariable,
  taskAchievedVariable,
} from '../../../../../template/common';

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

/** t1_state (0 idle, 1 pursued) and t1_achieved_ (backs the t1_achieved formula) */
export const taskVariables = (task: EdgeTask): string => {
  const logger = getLogger();
  logger.initTask(task);

  return `
  ${defineVariable(stateVariable(task.id))}
  ${defineVariable(taskAchievedVariable(task.id))}
`.trim();
};

/** formula t1_achieved = (t1_achieved_=1); — same interface as goal achieved formulas */
export const taskAchievedFormula = (task: EdgeTask): string =>
  `formula ${achievedFormula(task.id)} = (${taskAchievedVariable(task.id)}=1);`;

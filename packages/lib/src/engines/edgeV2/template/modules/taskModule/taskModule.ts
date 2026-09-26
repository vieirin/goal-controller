import type { EdgeTask } from '../../../types';
import { taskAchievabilityVariable } from '../changeManager/template/achievabilityVariables/taskAchievabilityVariables';
import { taskTransitions } from '../changeManager/template/tasks/transitions';
import {
  taskAchievedFormula,
  taskVariables,
} from '../changeManager/template/tasks/variables';

/**
 * One module per task, as in the EDGE reference:
 *   const double T1_achievable = 0.8;
 *   formula t1_achieved = (t1_achieved_=1);
 *   module T1
 *     t1_state: [0..1] init 0;
 *     t1_achieved_: [0..1] init 0;
 *     [pursue_T1] … [try_T1] … [achieved_T1] …
 *   endmodule
 * Same variables, commands and formulas as the ChangeManager layout.
 */
export const taskModule = (
  task: EdgeTask,
  variables: Record<string, boolean | number>,
): string => {
  const numericVariables = Object.fromEntries(
    Object.entries(variables).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>;

  return `${taskAchievabilityVariable(task, numericVariables)}
${taskAchievedFormula(task)}
module ${task.id}
  ${taskVariables(task)}
  ${taskTransitions(task).trim()}
endmodule`;
};

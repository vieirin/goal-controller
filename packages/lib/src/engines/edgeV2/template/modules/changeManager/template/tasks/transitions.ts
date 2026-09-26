import type { EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import {
  achievableFormulaVariable,
  achievedTransition,
  pursueTransition,
  stateVariable,
  taskAchievedVariable,
  tryTransition,
} from '../../../../../template/common';

type TaskTransitionKind = 'pursue' | 'try' | 'achieve';

const transition = (
  task: EdgeTask,
  kind: TaskTransitionKind,
  label: string,
  leftStatement: string,
  updateStatement: string,
): string => {
  const prismLabelStatement = `[${label}] ${leftStatement} -> ${updateStatement};`;
  getLogger().taskTranstions.transition(
    task.id,
    leftStatement,
    updateStatement,
    prismLabelStatement,
    kind,
    kind === 'try' ? task.properties.engine.maxRetries : undefined,
  );
  return prismLabelStatement;
};

/**
 * Reference task encoding:
 *   [pursue_T1]   t1_state=0 & t1_achieved_=0 -> (t1_state'=1);
 *   [try_T1]      t1_state=1 & t1_achieved_=0 -> T1_achievable: (t1_achieved_'=1) + 1-T1_achievable: (t1_state'=0);
 *   [achieved_T1] t1_state=1 & t1_achieved_=1 -> (t1_state'=0);
 */
export const taskTransitions = (task: EdgeTask): string => {
  const state = stateVariable(task.id);
  const achieved = taskAchievedVariable(task.id);
  const achievable = achievableFormulaVariable(task.id);
  return `
  // Task ${task.id}: ${task.name}
  ${transition(task, 'pursue', pursueTransition(task.id), `${state}=0 & ${achieved}=0`, `(${state}'=1)`)}
  ${transition(task, 'try', tryTransition(task.id), `${state}=1 & ${achieved}=0`, `${achievable}: (${achieved}'=1) + 1-${achievable}: (${state}'=0)`)}
  ${transition(task, 'achieve', achievedTransition(task.id), `${state}=1 & ${achieved}=1`, `(${state}'=0)`)}
  `;
};

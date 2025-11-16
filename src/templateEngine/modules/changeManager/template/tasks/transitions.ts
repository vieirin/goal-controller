import type { GoalNode } from '../../../../../GoalTree/types';
import { getLogger } from '../../../../../logger/logger';
import { parenthesis } from '../../../../../mdp/common';
import {
  achievableFormulaVariable,
  achievedTransition,
  achievedVariable,
  failedTransition,
  pursueTransition,
  pursuedVariable,
  tryTransition,
} from '../../../../common';
import {
  hasBeenAchieved,
  hasBeenAchievedAndPursued,
  hasBeenPursued,
} from '../../../goalModule/template/pursue/common';

const pursueTask = (task: GoalNode): string => {
  const logger = getLogger();
  const prismLabelStatement = `[${pursueTransition(task.id)}] true -> true;`;
  logger.taskTranstions.transition(
    task.id,
    'true',
    'true',
    prismLabelStatement,
    'pursue',
  );
  return prismLabelStatement;
};

const achieveTask = (task: GoalNode): string => {
  const logger = getLogger();
  const prismLabelStatement = `[${achievedTransition(task.id)}] true -> true;`;
  logger.taskTranstions.transition(
    task.id,
    'true',
    'true',
    prismLabelStatement,
    'achieve',
  );
  return prismLabelStatement;
};

const failedTask = (task: GoalNode): string => {
  const logger = getLogger();
  const leftStatement = `${pursuedVariable(task.id)}=1 & ${achievedVariable(
    task.id,
  )}=0`;

  const updateStatement = `(${pursuedVariable(task.id)}'=0)`;

  const prismLabelStatement = `[${failedTransition(
    task.id,
  )}] ${leftStatement} -> ${updateStatement};`;

  logger.taskTranstions.transition(
    task.id,
    leftStatement,
    updateStatement,
    prismLabelStatement,
    'failed',
    task.properties.maxRetries,
  );
  return prismLabelStatement;
};

const tryTask = (task: GoalNode): string => {
  const logger = getLogger();
  const taskAchievabilityVariable = achievableFormulaVariable(task.id);

  const leftStatement = `[${tryTransition(
    task.id,
  )}] ${hasBeenAchievedAndPursued(task, {
    achieved: false,
    pursued: true,
  })}`;
  const updateStatement = `${taskAchievabilityVariable}: ${parenthesis(
    hasBeenAchieved(task, {
      condition: true,
      update: true,
    }),
  )} + 1-${taskAchievabilityVariable}: ${parenthesis(
    hasBeenPursued(task, { condition: false, update: true }),
  )};`;
  const tryStatement = `${leftStatement} -> ${updateStatement}`;
  logger.taskTranstions.transition(
    task.id,
    leftStatement,
    updateStatement,
    tryStatement,
    'try',
    task.properties.maxRetries,
  );

  return tryStatement;
};

export const taskTransitions = (task: GoalNode): string => {
  return `
  ${pursueTask(task)}
  ${tryTask(task)}
  ${achieveTask(task)}
  ${failedTask(task)}
  `;
};

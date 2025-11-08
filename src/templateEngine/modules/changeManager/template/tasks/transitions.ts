import type { GoalNode } from '../../../../../GoalTree/types';
import { getLogger } from '../../../../../logger/logger';
import { failed, parenthesis } from '../../../../../mdp/common';
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

const pursueTask = (task: GoalNode) => {
  const logger = getLogger();
  const prismLabelStatement = `[${pursueTransition(task.id)}] true -> true;`;
  logger.taskTranstions.transition(
    task.id,
    'true',
    'true',
    prismLabelStatement,
    'pursue'
  );
  return prismLabelStatement;
};

const achieveTask = (task: GoalNode) => {
  const logger = getLogger();
  const prismLabelStatement = `[${achievedTransition(task.id)}] true -> true;`;
  logger.taskTranstions.transition(
    task.id,
    'true',
    'true',
    prismLabelStatement,
    'achieve'
  );
  return prismLabelStatement;
};

const failedTask = (task: GoalNode) => {
  const logger = getLogger();
  const leftStatement = `${pursuedVariable(task.id)}=1 & ${achievedVariable(
    task.id
  )}=0`;

  const updateStatement = `(${pursuedVariable(task.id)}'=0)${
    task.properties.maxRetries
      ? ` & (${failed(task.id)}'=min(${task.properties.maxRetries}, ${failed(
          task.id
        )}+1))`
      : ''
  }`;

  const prismLabelStatement = `[${failedTransition(
    task.id
  )}] ${leftStatement} -> ${updateStatement};`;

  logger.taskTranstions.transition(
    task.id,
    leftStatement,
    updateStatement,
    prismLabelStatement,
    'failed',
    task.properties.maxRetries
  );
  return prismLabelStatement;
};

const tryTask = (task: GoalNode) => {
  const taskAchievabilityVariable = achievableFormulaVariable(task.id);

  return `[${tryTransition(task.id)}] ${hasBeenAchievedAndPursued(task, {
    achieved: false,
    pursued: true,
  })} -> ${taskAchievabilityVariable}: ${parenthesis(
    hasBeenAchieved(task, {
      condition: true,
      update: true,
    })
  )} + 1-${taskAchievabilityVariable}: ${parenthesis(
    hasBeenPursued(task, { condition: false, update: true })
  )};`;
};

export const taskTransitions = (task: GoalNode) => {
  return `
  ${pursueTask(task)}
  ${tryTask(task)}
  ${achieveTask(task)}
  ${failedTask(task)}
  `;
};

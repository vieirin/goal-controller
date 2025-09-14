import { getLogger } from '../../../logger/logger';
import { failed } from '../../../mdp/common';
import type { GoalNode } from '../../../ObjectiveTree/types';
import {
  achievedTransition,
  achievedVariable,
  failedTransition,
  pursueTransition,
  pursuedVariable,
} from '../../common';

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
    task.customProperties.maxRetries
      ? ` & (${failed(task.id)}'=min(${
          task.customProperties.maxRetries
        }, ${failed(task.id)}+1))`
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
    'failed'
  );
  return prismLabelStatement;
};

const maxRetriesVariable = (task: GoalNode) => {
  if (!task.customProperties.maxRetries) {
    return '';
  }
  const logger = getLogger();

  logger.variableDefinition(failed(task.id), task.customProperties.maxRetries);
  return `${failed(task.id)}: [0..${task.customProperties.maxRetries}] init 0;`;
};

export const taskVariables = (task: GoalNode) => {
  const logger = getLogger();
  logger.initTask(task);
  logger.variableDefinition(pursuedVariable(task.id), 1);
  logger.variableDefinition(achievedVariable(task.id), 1);
  return `
  ${pursuedVariable(task.id)} : [0..1] init 0;
  ${achievedVariable(task.id)} : [0..1] init 0;
  ${maxRetriesVariable(task)}
`.trimEnd();
};

export const taskTransitions = (task: GoalNode) => {
  return `
  ${pursueTask(task)}
  ${achieveTask(task)}
  ${failedTask(task)}
  `;
};

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
    'failed',
    task.customProperties.maxRetries
  );
  return prismLabelStatement;
};

const maxRetriesVariable = (task: GoalNode) => {
  if (!task.customProperties.maxRetries) {
    return '';
  }
  const logger = getLogger();

  logger.variableDefinition({
    variable: failed(task.id),
    upperBound: task.customProperties.maxRetries,
    initialValue: 0,
    type: 'int',
  });
  return `${failed(task.id)}: [0..${task.customProperties.maxRetries}] init 0;`;
};

const defineVariable = (variable: string) => {
  const upperBound = 1;

  const logger = getLogger();
  logger.variableDefinition({
    variable,
    upperBound,
    initialValue: 0,
    type: 'int',
  });
  return `${variable} : [0..${upperBound}] init 0;`;
};

export const taskVariables = (task: GoalNode) => {
  const logger = getLogger();
  logger.initTask(task);

  return `
  ${defineVariable(pursuedVariable(task.id))}
  ${defineVariable(achievedVariable(task.id))}
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

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
  return `[${pursueTransition(task.id)}] true -> true;`;
};

const achieveTask = (task: GoalNode) => {
  return `[${achievedTransition(task.id)}] true -> true;`;
};

const failedTask = (task: GoalNode) => {
  return `[${failedTransition(task.id)}] ${pursuedVariable(
    task.id
  )}=1 & ${achievedVariable(task.id)}=0 -> (${pursuedVariable(task.id)}'=0)${
    task.customProperties.maxRetries
      ? ` & (${failed(task.id)}'=min(${
          task.customProperties.maxRetries
        }, ${failed(task.id)}+1))`
      : ''
  };`;
};

const maxRetriesVariable = (task: GoalNode) => {
  if (!task.customProperties.maxRetries) {
    return '';
  }
  return `${failed(task.id)}: [0..${task.customProperties.maxRetries}] init 0;`;
};

export const taskVariables = (task: GoalNode) => {
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

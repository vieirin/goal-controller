import type { EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import { parenthesis } from '../../../../../mdp/common';
import {
  achievableFormulaVariable,
  achievedTransition,
  pursueTransition,
  tryTransition,
} from '../../../../../template/common';
import {
  hasBeenAchieved,
  hasBeenAchievedAndPursued,
  hasBeenPursued,
} from '../../../goalModule/template/pursue/common';

const pursueTask = (task: EdgeTask): string => {
  const logger = getLogger();
  const leftStatement = `${hasBeenPursued(task, {
    condition: false,
  })} & ${hasBeenAchieved(task, { condition: false })}`;
  const updateStatement = `(${hasBeenPursued(task, {
    condition: true,
    update: true,
  })})`;
  const prismLabelStatement = `[${pursueTransition(
    task.id,
  )}] ${leftStatement} -> ${updateStatement};`;
  logger.taskTranstions.transition(
    task.id,
    leftStatement,
    updateStatement,
    prismLabelStatement,
    'pursue',
  );
  return prismLabelStatement;
};

const achieveTask = (task: EdgeTask): string => {
  const logger = getLogger();
  const leftStatement = `${hasBeenAchievedAndPursued(task, {
    achieved: true,
    pursued: true,
  })}`;
  const prismLabelStatement = `[${achievedTransition(
    task.id,
  )}] ${leftStatement} -> true;`;
  logger.taskTranstions.transition(
    task.id,
    leftStatement,
    'true',
    prismLabelStatement,
    'achieve',
  );
  return prismLabelStatement;
};

const tryTask = (task: EdgeTask): string => {
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
    task.properties.engine.maxRetries,
  );

  return tryStatement;
};

export const taskTransitions = (task: EdgeTask): string => {
  return `
  // Task ${task.id}: ${task.name}
  ${pursueTask(task)}
  ${tryTask(task)}
  ${achieveTask(task)}
  `;
};

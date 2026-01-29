import type { Task } from '@goal-controller/goal-tree';
import { renameTaskId, taskFluentName } from './shared';
import type { SleecTaskProps } from './types';

type SleecTask = Task<SleecTaskProps>;

const generateObstacleEventsRules = (task: SleecTask): string => {
  return `Rule${renameTaskId(task.id)}_Obstacle when Achieved${task.properties.engine?.ObstacleEvent} then not ${taskFluentName(task, 'Pursuing')}`;
};

export const generateTaskRules = (tasks: SleecTask[]): string => {
  const hasObstacleEvents = (task: SleecTask) =>
    !!task.properties.engine?.ObstacleEvent;
  return `rule_start
      ${tasks
        .map((task) => {
          return `
      Rule${renameTaskId(task.id)}_1 when ${
        task.properties.engine?.TriggeringEvent
      } and ${task.properties.engine?.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within ${
        task.properties.engine?.TemporalConstraint
      }
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} and ${task.properties.engine?.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${task.properties.engine?.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )} 
      ${hasObstacleEvents(task) ? generateObstacleEventsRules(task) : ''}`;
        })
        .join('\n')}
rule_end`;
};

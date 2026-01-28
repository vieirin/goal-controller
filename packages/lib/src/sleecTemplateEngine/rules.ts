import type { Task } from '@goal-controller/goal-tree';
import { renameTaskId, taskFluentName } from './shared';

const generateObstacleEventsRules = (task: Task): string => {
  return `Rule${renameTaskId(task.id)}_Obstacle when Achieved${task.properties.sleec?.ObstacleEvent} then not ${taskFluentName(task, 'Pursuing')}`;
};

export const generateTaskRules = (tasks: Task[]): string => {
  const hasObstacleEvents = (task: Task) =>
    !!task.properties.sleec?.ObstacleEvent;
  return `rule_start
      ${tasks
        .map((task) => {
          return `
      Rule${renameTaskId(task.id)}_1 when ${
        task.properties.sleec?.TriggeringEvent
      } and ${task.properties.sleec?.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within ${
        task.properties.sleec?.TemporalConstraint
      }
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} and ${task.properties.sleec?.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${task.properties.sleec?.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )} 
      ${hasObstacleEvents(task) ? generateObstacleEventsRules(task) : ''}`;
        })
        .join('\n')}
rule_end`;
};

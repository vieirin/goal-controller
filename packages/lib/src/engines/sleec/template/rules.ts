import type { Task } from '@goal-controller/goal-tree';
import { renameTaskId, taskFluentName } from './shared';
import type { SleecTaskProps } from '../types';

type SleecTask = Task<SleecTaskProps>;

const generateObstacleEventsRules = (task: SleecTask): string => {
  const obstacleEvent = task.properties.engine?.ObstacleEvent;
  if (!obstacleEvent) return '';
  return `Rule${renameTaskId(task.id)}_Obstacle when Achieved${obstacleEvent} then not ${taskFluentName(task, 'Pursuing')}`;
};

/**
 * Validates that a task has all required SLEEC properties for rule generation
 */
const hasRequiredSleecProps = (task: SleecTask): boolean => {
  const engine = task.properties.engine;
  return !!(
    engine?.TriggeringEvent &&
    engine?.PreCond &&
    engine?.TemporalConstraint &&
    engine?.PostCond
  );
};

export const generateTaskRules = (tasks: SleecTask[]): string => {
  const hasObstacleEvents = (task: SleecTask) =>
    !!task.properties.engine?.ObstacleEvent;

  // Filter tasks that have all required SLEEC properties
  const validTasks = tasks.filter(hasRequiredSleecProps);

  return `rule_start
      ${validTasks
        .map((task) => {
          const engine = task.properties.engine!;
          return `
      Rule${renameTaskId(task.id)}_1 when ${engine.TriggeringEvent} and ${engine.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within ${engine.TemporalConstraint}
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} and ${engine.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${engine.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )} 
      ${hasObstacleEvents(task) ? generateObstacleEventsRules(task) : ''}`;
        })
        .join('\n')}
rule_end`;
};

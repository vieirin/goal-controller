import type { GoalNode } from '../GoalTree/types';
import { renameTaskId, taskFluentName } from './shared';

const generateObstacleEventsRules = (task: GoalNode): string => {
  return `Rule${renameTaskId(task.id)}_Obstacle when Achieved${task.properties.ObstacleEvent} then not ${taskFluentName(task, 'Pursuing')}`;
};

export const generateTaskRules = (tasks: GoalNode[]): string => {
  const hasObstacleEvents = (task: GoalNode) => !!task.properties.ObstacleEvent;
  return `rule_start
      ${tasks
        .map((task) => {
          return `
      Rule${renameTaskId(task.id)}_1 when ${
        task.properties.TriggeringEvent
      } and ${task.properties.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within ${
        task.properties.TemporalConstraint
      }
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} and ${task.properties.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${task.properties.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )} 
      ${hasObstacleEvents(task) ? generateObstacleEventsRules(task) : ''}`;
        })
        .join('\n')}
rule_end`;
};

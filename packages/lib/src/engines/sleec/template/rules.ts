import type { SleecTask } from '../mapper';
import { renameTaskId, taskFluentName } from './shared';

/** Every task's rules: the mapper gives each task its four required properties (or throws). */
export const generateTaskRules = (tasks: SleecTask[]): string => {
  return `rule_start
      ${tasks
        .map((task) => {
          const engine = task.properties.engine;
          return `
      Rule${renameTaskId(task.id)}_1 when ${engine.TriggeringEvent} and ${engine.PreCond} then ${taskFluentName(task, 'Start')}
     
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within 5 seconds
     
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} then ${taskFluentName(
        task,
        'Stop',
      )} within ${engine.TemporalConstraint}
      
      Rule${renameTaskId(task.id)}_4 when ${taskFluentName(
        task,
        'Stop',
      )} and ${engine.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${engine.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )}
        
      ${
        engine.ObstacleEvent
          ? `Rule${renameTaskId(task.id)}_5 when ${taskFluentName(
              task,
              'Pursuing',
            )} and ${engine.ObstacleEvent} then ${taskFluentName(task, 'Stop')}
      `
          : ''
      }`.trim();
        })
        .join('\n')}
rule_end`;
};

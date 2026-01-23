import type { GoalNode, GoalTree } from '../GoalTree/types';
import { allByType } from '../GoalTree/utils';

const renameTaskId = (id: string) => id.replace('.', '_');

const taskFluentName = (
  task: GoalNode,
  op: 'Start' | 'Pursuing' | 'Achieved' | 'ReportFailure',
) => {
  return `${op}${task.properties.FluentName}`;
};
const generateTaskRules = (tasks: GoalNode[]): string => {
  const hasAvoidEvents = (task: GoalNode) => !!task.properties.AvoidEvent;
  return `rules
      ${tasks
        .map((task) => {
          return `Rule${renameTaskId(task.id)}_1 when ${
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
      ${hasAvoidEvents(task) ? generateAvoidEventsRules(task) : ''}`;
        })
        .join('\n')}
    end`;
};

function generateAvoidEventsRules(task: GoalNode): string {
  return `Rule${renameTaskId(task.id)}_4 when Achieved${
    task.properties.AvoidEvent
  } then ${taskFluentName(task, 'Pursuing')}`;
}

export const sleecTemplateEngine = (tree: GoalTree): string => {
  const tasks = allByType({ gm: tree, type: 'task' });
  return `${generateTaskRules(tasks)}`;
};

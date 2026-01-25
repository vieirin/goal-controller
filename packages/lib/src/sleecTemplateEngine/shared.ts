import type { GoalNode } from '../GoalTree/types';

export const renameTaskId = (id: string) => id.replace('.', '_');

export const getFluentName = (task: GoalNode): string | undefined =>
  task.name?.replaceAll(' ', '');

export const taskFluentName = (
  task: GoalNode,
  op: 'Start' | 'Pursuing' | 'Achieved' | 'ReportFailure',
) => {
  return `${op}${getFluentName(task)}`;
};

export const fluentOperations = [
  'Start',
  'Pursuing',
  'Achieved',
  'ReportFailure',
] as const;

export type MeasureType = 'boolean' | 'scale';

export type Measure = {
  name: string;
  type: MeasureType;
  scaleValues?: string[];
};

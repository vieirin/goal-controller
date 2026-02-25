import type { Task } from '@goal-controller/goal-tree';

export const renameTaskId = (id: string): string => id.replace('.', '_');

export const getFluentName = (task: Task): string | undefined =>
  task.name?.replaceAll(' ', '');

export const fluentOperations = [
  'Start',
  'Pursuing',
  'Stop',
  'Achieved',
  'ReportFailure',
] as const;

type FluentOperation = (typeof fluentOperations)[number];

export const taskFluentName = (task: Task, op: FluentOperation): string => {
  return `${op}${getFluentName(task)}`;
};

export type MeasureType = 'boolean' | 'scale';

export type Measure = {
  name: string;
  type: MeasureType;
  scaleValues?: string[];
};

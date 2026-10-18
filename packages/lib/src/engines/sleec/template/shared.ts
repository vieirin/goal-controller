import type { SleecTask } from '../mapper';

export const renameTaskId = (id: string): string => id.replace('.', '_');

export const getFluentName = (task: SleecTask): string | undefined =>
  task.name?.replaceAll(' ', '');

export const fluentOperations = [
  'Start',
  'Pursuing',
  'Stop',
  'Achieved',
  'ReportFailure',
] as const;

type FluentOperation = (typeof fluentOperations)[number];

export const taskFluentName = (
  task: SleecTask,
  op: FluentOperation,
): string => {
  return `${op}${getFluentName(task)}`;
};

export type MeasureType = 'boolean' | 'scale';

export type Measure = {
  name: string;
  type: MeasureType;
  scaleValues?: string[];
};

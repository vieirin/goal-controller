import type { Task } from '@goal-controller/goal-tree';
import { getFluentName, taskFluentName } from './shared';

/**
 * Generates a single fluent definition line for a task.
 * Format: fluent TaskName <{StartTaskName}, {AchievedTaskName}>
 */
const fluentLine = (task: Task): string | undefined => {
  const fluentName = getFluentName(task);
  if (!fluentName) return undefined;

  const startEvent = taskFluentName(task, 'Start');
  const achievedEvent = taskFluentName(task, 'Achieved');

  return `    fluent ${fluentName} <{${startEvent}}, {${achievedEvent}}>`;
};

/**
 * Generates fluent definitions for all tasks.
 * Each fluent represents the state of a task being active (started but not yet achieved).
 *
 * Example output:
 *   fluent InformPurposeandProtocol <{StartInformPurposeandProtocol}, {AchievedInformPurposeandProtocol}>
 *   fluent ObtainConsentFullTracking <{StartObtainConsentFullTracking}, {AchievedObtainConsentFullTracking}>
 */
export const generateFluents = (tasks: Task[]): string[] => {
  return tasks.map(fluentLine).filter((line): line is string => !!line);
};

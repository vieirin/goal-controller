/**
 * SLEEC Engine Mapper
 * Maps raw iStar model properties to SLEEC engine-specific properties
 */
import {
  createEngineMapper,
  type GoalNode,
  type GoalTreeType,
  type RawProps,
  type Task,
} from '@goal-controller/goal-tree';
import type { SleecGoalProps, SleecTaskProps } from './types';

/**
 * Allowed keys for SLEEC goal custom properties
 */
export const SLEEC_GOAL_KEYS = [
  'Type',
  'Source',
  'Class',
  'NormPrinciple',
  'Proxy',
  'AddedValue',
  'Condition',
  'Event',
  'ContextEvent',
] as const;

/**
 * Allowed keys for SLEEC task custom properties
 */
export const SLEEC_TASK_KEYS = [
  'PreCond',
  'TriggeringEvent',
  'TemporalConstraint',
  'PostCond',
  'ObstacleEvent',
] as const;

// Type aliases for the allowed keys
export type SleecGoalKey = (typeof SLEEC_GOAL_KEYS)[number];
export type SleecTaskKey = (typeof SLEEC_TASK_KEYS)[number];

const extractSleecGoalProps = (raw: RawProps<SleecGoalKey>): SleecGoalProps => {
  const sleecProps: SleecGoalProps = {};

  for (const key of SLEEC_GOAL_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') {
      sleecProps[key] = value;
    }
  }

  return sleecProps;
};

const extractSleecTaskProps = (raw: RawProps<SleecTaskKey>): SleecTaskProps => {
  const sleecProps: SleecTaskProps = {};

  if (raw.PreCond) sleecProps.PreCond = raw.PreCond;
  if (raw.TriggeringEvent) sleecProps.TriggeringEvent = raw.TriggeringEvent;
  if (raw.TemporalConstraint)
    sleecProps.TemporalConstraint = raw.TemporalConstraint;
  if (raw.PostCond) sleecProps.PostCond = raw.PostCond;
  if (raw.ObstacleEvent) sleecProps.ObstacleEvent = raw.ObstacleEvent;

  return sleecProps;
};

/**
 * SLEEC Engine Mapper for creating SLEEC-compatible goal trees
 * Note: SLEEC doesn't use dependsOn, so no afterCreationMapper is needed
 * Note: SLEEC doesn't use resources, so skipResource is set to true
 * Engine types are explicit, key types are inferred from the allowedKeys arrays
 */
export const sleecEngineMapper = createEngineMapper<
  SleecGoalProps,
  SleecTaskProps,
  never
>()({
  allowedGoalKeys: SLEEC_GOAL_KEYS,
  allowedTaskKeys: SLEEC_TASK_KEYS,
  skipResource: true,
  mapGoalProps: ({ raw }) => extractSleecGoalProps(raw),
  mapTaskProps: ({ raw }) => extractSleecTaskProps(raw),
});

/**
 * Type aliases for SLEEC-specific tree types
 * Note: TResourceEngine is `never` because SLEEC skips resources
 */
export type SleecGoalNode = GoalNode<SleecGoalProps, SleecTaskProps, never>;
export type SleecTask = Task<SleecTaskProps, never>;
export type SleecGoalTree = GoalTreeType<SleecGoalProps, SleecTaskProps, never>;

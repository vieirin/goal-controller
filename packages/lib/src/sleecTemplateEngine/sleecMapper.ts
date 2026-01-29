/**
 * SLEEC Engine Mapper
 * Maps raw iStar model properties to SLEEC engine-specific properties
 */
import type {
  EngineMapper,
  GoalNode,
  GoalTreeType,
  RawGoalProps,
  RawTaskProps,
  Task,
} from '@goal-controller/goal-tree';
import type { SleecGoalProps, SleecTaskProps } from './types';

const SLEEC_GOAL_PROP_KEYS = [
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

const extractSleecGoalProps = (raw: RawGoalProps): SleecGoalProps => {
  const sleecProps: SleecGoalProps = {};

  for (const key of SLEEC_GOAL_PROP_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') {
      sleecProps[key] = value;
    }
  }

  return sleecProps;
};

const extractSleecTaskProps = (raw: RawTaskProps): SleecTaskProps => {
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
 */
export const sleecEngineMapper: EngineMapper<SleecGoalProps, SleecTaskProps> = {
  mapGoalProps: ({ raw }: { raw: RawGoalProps }) => {
    return extractSleecGoalProps(raw);
  },

  mapTaskProps: ({ raw }: { raw: RawTaskProps }) => {
    return extractSleecTaskProps(raw);
  },
};

/**
 * Type aliases for SLEEC-specific tree types
 */
export type SleecGoalNode = GoalNode<SleecGoalProps, SleecTaskProps>;
export type SleecTask = Task<SleecTaskProps>;
export type SleecGoalTree = GoalTreeType<SleecGoalProps, SleecTaskProps>;

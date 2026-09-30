import {
  EDGE_GOAL_KEYS,
  EDGE_RESOURCE_KEYS,
  EDGE_TASK_KEYS,
  EDGE_V2_GOAL_KEYS,
  EDGE_V2_RESOURCE_KEYS,
  EDGE_V2_TASK_KEYS,
  SLEEC_GOAL_KEYS,
  SLEEC_TASK_KEYS,
} from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';

/** The custom properties each engine reads, per node kind. */
export const KNOWN_PROPERTIES: Record<
  TransformEngine,
  AnalyzeResponse['knownProperties']
> = {
  edge: {
    goal: [...EDGE_GOAL_KEYS],
    task: [...EDGE_TASK_KEYS],
    resource: [...EDGE_RESOURCE_KEYS],
  },
  edgev2: {
    goal: [...EDGE_V2_GOAL_KEYS],
    task: [...EDGE_V2_TASK_KEYS],
    resource: [...EDGE_V2_RESOURCE_KEYS],
  },
  sleec: {
    goal: [...SLEEC_GOAL_KEYS],
    task: [...SLEEC_TASK_KEYS],
    resource: [],
  },
};

import {
  edgeEngineMapper,
  edgeV2EngineMapper,
  sleecEngineMapper,
} from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';

/** The custom properties each engine reads, per node kind, read from its mapper. */
export const KNOWN_PROPERTIES: Record<
  TransformEngine,
  AnalyzeResponse['knownProperties']
> = {
  edge: {
    goal: [...edgeEngineMapper.allowedGoalKeys],
    task: [...edgeEngineMapper.allowedTaskKeys],
    resource: edgeEngineMapper.skipResource
      ? []
      : [...edgeEngineMapper.allowedResourceKeys],
  },
  edgev2: {
    goal: [...edgeV2EngineMapper.allowedGoalKeys],
    task: [...edgeV2EngineMapper.allowedTaskKeys],
    resource: edgeV2EngineMapper.skipResource
      ? []
      : [...edgeV2EngineMapper.allowedResourceKeys],
  },
  sleec: {
    goal: [...sleecEngineMapper.allowedGoalKeys],
    task: [...sleecEngineMapper.allowedTaskKeys],
    resource: sleecEngineMapper.skipResource
      ? []
      : [...sleecEngineMapper.allowedResourceKeys],
  },
};

import {
  edgeEngineMapper,
  edgeV2EngineMapper,
  sleecEngineMapper,
} from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';

type Mapper = {
  allowedGoalKeys: readonly string[];
  allowedTaskKeys: readonly string[];
  allowedResourceKeys?: readonly string[];
  skipResource?: boolean;
};

const keysOf = (m: Mapper): AnalyzeResponse['knownProperties'] => ({
  goal: [...m.allowedGoalKeys],
  task: [...m.allowedTaskKeys],
  resource: m.skipResource ? [] : [...(m.allowedResourceKeys ?? [])],
});

/** The custom properties each engine reads, per node kind, read from its mapper. */
export const KNOWN_PROPERTIES: Record<
  TransformEngine,
  AnalyzeResponse['knownProperties']
> = {
  edge: keysOf(edgeEngineMapper),
  edgev2: keysOf(edgeV2EngineMapper),
  sleec: keysOf(sleecEngineMapper),
};

import { propertyKeys } from '@goal-controller/dialect';
import { sleecEngineMapper } from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';
import { ENGINE_DIALECTS } from '../workbench/definitions';

type Mapper = {
  allowedGoalKeys: readonly string[];
  allowedTaskKeys: readonly string[];
  allowedResourceKeys?: readonly string[];
  allowedQualityKeys?: readonly string[];
  skipResource?: boolean;
};

const keysOf = (m: Mapper): AnalyzeResponse['knownProperties'] => ({
  goal: [...m.allowedGoalKeys],
  task: [...m.allowedTaskKeys],
  resource: m.skipResource ? [] : [...(m.allowedResourceKeys ?? [])],
  quality: [...(m.allowedQualityKeys ?? [])],
});

const definedKeys = (
  definition: (typeof ENGINE_DIALECTS)[keyof typeof ENGINE_DIALECTS],
): AnalyzeResponse['knownProperties'] => ({
  goal: [...propertyKeys(definition, 'goal')],
  task: [...propertyKeys(definition, 'task')],
  resource: [...propertyKeys(definition, 'resource')],
  quality: [...propertyKeys(definition, 'quality')],
});

/**
 * The custom properties each engine reads, per node kind: from its definition (the Edge
 * engines), or from its mapper (SLEEC has no definition).
 */
export const KNOWN_PROPERTIES: Record<
  TransformEngine,
  AnalyzeResponse['knownProperties']
> = {
  edge: definedKeys(ENGINE_DIALECTS.edge),
  edgev2: definedKeys(ENGINE_DIALECTS.edgev2),
  sleec: keysOf(sleecEngineMapper),
};

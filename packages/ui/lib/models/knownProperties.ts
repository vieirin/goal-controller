import {
  isExtensionKind,
  propertyKeys,
  type AnyDialect,
} from '@goal-controller/dialect';
import { grlEngineMapper, sleecEngineMapper } from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';
import { ENGINE_DIALECTS } from '../workbench/engineDialects';

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

type Definition = (typeof ENGINE_DIALECTS)[keyof typeof ENGINE_DIALECTS];

/** The keys of the extension's kinds a definition gives properties (goal-controller#132). */
const extensionKeys = (definition: Definition) =>
  Object.fromEntries(
    Object.keys(definition.properties)
      .filter(isExtensionKind)
      .map((kind) => [kind, [...propertyKeys(definition as AnyDialect, kind)]]),
  );

const definedKeys = (
  definition: Definition,
): AnalyzeResponse['knownProperties'] => ({
  goal: [...propertyKeys(definition, 'goal')],
  task: [...propertyKeys(definition, 'task')],
  resource: [...propertyKeys(definition, 'resource')],
  quality: [...propertyKeys(definition, 'quality')],
  ...extensionKeys(definition),
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
  mutrose: definedKeys(ENGINE_DIALECTS.mutrose),
  goda: definedKeys(ENGINE_DIALECTS.goda),
  // GRL's element properties are read but not declarable yet (#105): its
  // mapper's; an indicator's are declared (goal-controller#132)
  grl: { ...keysOf(grlEngineMapper), ...extensionKeys(ENGINE_DIALECTS.grl) },
  istardt: {
    ...definedKeys(ENGINE_DIALECTS.istardt),
    ...extensionKeys(ENGINE_DIALECTS.istardt),
  },
  tropos4as: definedKeys(ENGINE_DIALECTS.tropos4as),
};

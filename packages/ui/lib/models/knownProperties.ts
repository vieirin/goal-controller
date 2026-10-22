import {
  isExtensionKind,
  propertyKeys,
  type AnyDialect,
} from '@goal-controller/dialect';
import { GRL_ELEMENT_KEYS, sleecEngineMapper } from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';
import {
  ENGINE_DIALECTS,
  FRAMEWORK_ENGINE_DIALECTS,
} from '../workbench/engineDialects';

/** GRL's element keys (#105: read, not yet declarable): on its goals, tasks and qualities. */
const GRL_KEYS: AnalyzeResponse['knownProperties'] = {
  goal: [...GRL_ELEMENT_KEYS],
  task: [...GRL_ELEMENT_KEYS],
  resource: [],
  quality: [...GRL_ELEMENT_KEYS],
};

/** SLEEC's keys: its mapper's dialect gives them (it has no definition), no resource's. */
const SLEEC_KEYS: AnalyzeResponse['knownProperties'] = {
  goal: [...propertyKeys(sleecEngineMapper.dialect, 'goal')],
  task: [...propertyKeys(sleecEngineMapper.dialect, 'task')],
  resource: [],
  quality: [...propertyKeys(sleecEngineMapper.dialect, 'quality')],
};

type Definition = (typeof ENGINE_DIALECTS)[keyof typeof ENGINE_DIALECTS];

/** The keys of the extension's kinds a definition gives properties (goal-controller#132), a framework's kinds too. */
const extensionKeys = (definition: AnyDialect) =>
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

/** A framework's engine (goal-controller#171): no iStar kind, its root's kinds' keys. */
const frameworkKeys = (
  definition: AnyDialect,
): AnalyzeResponse['knownProperties'] => ({
  goal: [],
  task: [],
  resource: [],
  quality: [],
  ...extensionKeys(definition),
});

/**
 * The custom properties each engine reads, per node kind: from its definition (the Edge
 * engines), or from its mapper's dialect (SLEEC has no definition).
 */
export const KNOWN_PROPERTIES: Record<
  TransformEngine,
  AnalyzeResponse['knownProperties']
> = {
  edge: definedKeys(ENGINE_DIALECTS.edge),
  edgev2: definedKeys(ENGINE_DIALECTS.edgev2),
  sleec: SLEEC_KEYS,
  mutrose: definedKeys(ENGINE_DIALECTS.mutrose),
  goda: definedKeys(ENGINE_DIALECTS.goda),
  // GRL's element properties are read but not declarable yet (#105); an
  // indicator's are declared (goal-controller#132)
  grl: { ...GRL_KEYS, ...extensionKeys(ENGINE_DIALECTS.grl) },
  istardt: {
    ...definedKeys(ENGINE_DIALECTS.istardt),
    ...extensionKeys(ENGINE_DIALECTS.istardt),
  },
  tropos4as: definedKeys(ENGINE_DIALECTS.tropos4as),
  cgm: definedKeys(ENGINE_DIALECTS.cgm),
  kaosdoc: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaosdoc),
  kaoslts: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaoslts),
  kaosprop: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaosprop),
  kaosexpert: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaosexpert),
  kaosres: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaosres),
  kaossim: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.kaossim),
  nfrprop: frameworkKeys(FRAMEWORK_ENGINE_DIALECTS.nfrprop),
};

import {
  isExtensionKind,
  propertyKeys,
  type AnyDialect,
} from '@goal-controller/dialect';
import type { Engine } from '@goal-controller/lib';
import type { TransformEngine } from '../types';
import type { AnalyzeResponse } from '../workbench/types';
import { ENGINE_LIST } from '../workbench/engineDialects';

type Keys = AnalyzeResponse['knownProperties'];

/** The keys of the extension's kinds a definition gives properties (goal-controller#132), a framework's kinds too. */
const extensionKeys = (definition: AnyDialect) =>
  Object.fromEntries(
    Object.keys(definition.properties)
      .filter(isExtensionKind)
      .map((kind) => [kind, [...propertyKeys(definition, kind)]]),
  );

/** An iStar dialect's keys, by kind, its extension's kinds' too. */
const definedKeys = (definition: AnyDialect): Keys => ({
  goal: [...propertyKeys(definition, 'goal')],
  task: [...propertyKeys(definition, 'task')],
  resource: [...propertyKeys(definition, 'resource')],
  quality: [...propertyKeys(definition, 'quality')],
  ...extensionKeys(definition),
});

/** A framework's engine (goal-controller#171): no iStar kind, its root's kinds' keys. */
const frameworkKeys = (definition: AnyDialect): Keys => ({
  goal: [],
  task: [],
  resource: [],
  quality: [],
  ...extensionKeys(definition),
});

/** An engine without a definition (SLEEC): its mapper's dialect's keys, no resource's. */
const mapperKeys = (engine: Engine): Keys => {
  const dialect = engine.mapper.dialect as unknown as AnyDialect;
  return {
    goal: [...propertyKeys(dialect, 'goal')],
    task: [...propertyKeys(dialect, 'task')],
    resource: [],
    quality: [...propertyKeys(dialect, 'quality')],
  };
};

/** The keys an engine reads, by kind: its dialect's, and those it reads beside them (GRL's, #105). */
const keysOf = (engine: Engine): Keys => {
  const { dialect } = engine;
  const declared = !dialect
    ? mapperKeys(engine)
    : (dialect.framework ?? 'istar-2.0') !== 'istar-2.0'
      ? frameworkKeys(dialect)
      : definedKeys(dialect);
  return Object.assign(
    declared,
    Object.fromEntries(
      Object.entries(engine.readKeys ?? {}).map(([kind, keys]) => [
        kind,
        [...(keys ?? [])],
      ]),
    ),
  );
};

/**
 * The custom properties each engine reads, per node kind: from its definition,
 * or from its mapper's dialect (SLEEC has no definition).
 */
export const KNOWN_PROPERTIES = Object.fromEntries(
  ENGINE_LIST.map((engine) => [engine.id, keysOf(engine)]),
) as Record<TransformEngine, Keys>;

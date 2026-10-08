/**
 * The engine definitions the workbench is built from (@goal-controller/definitions),
 * by workbench engine id: the one place an engine's definition is picked.
 */
import { edge, edgeV2 } from '@goal-controller/definitions';
import { edgeCheckRegistry, type Check } from '@goal-controller/lib';
import type { TransformEngine } from '@/lib/types';

export const ENGINE_DEFINITIONS = { edge, edgev2: edgeV2 } as const;

export type DefinedEngine = keyof typeof ENGINE_DEFINITIONS;

/** The engine library's checks each definition names, by name. */
export const ENGINE_CHECKS: Record<
  DefinedEngine,
  Readonly<Record<string, Check>>
> = {
  edge: edgeCheckRegistry,
  edgev2: edgeCheckRegistry,
};

export const isDefinedEngine = (
  engine: TransformEngine,
): engine is DefinedEngine => engine in ENGINE_DEFINITIONS;

/**
 * The definition whose notation an engine's view shows: SLEEC has none of its own
 * and reads goal texts with Edge's grammar (services/tree.ts).
 */
export const notationDefinitionOf = (engine: TransformEngine) =>
  ENGINE_DEFINITIONS[isDefinedEngine(engine) ? engine : 'edge'];

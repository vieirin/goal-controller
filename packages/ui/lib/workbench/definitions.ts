/**
 * The engine definitions the workbench is built from (@goal-controller/definitions),
 * by workbench engine id: the one place an engine's definition is picked.
 */
import { edge, edgeV2 } from '@goal-controller/definitions';
import type { TransformEngine } from '@/lib/types';

export const ENGINE_DEFINITIONS = { edge, edgev2: edgeV2 } as const;

export type DefinedEngine = keyof typeof ENGINE_DEFINITIONS;

export const isDefinedEngine = (
  engine: TransformEngine,
): engine is DefinedEngine => engine in ENGINE_DEFINITIONS;

/**
 * The definition whose notation an engine's view shows: SLEEC has none of its own
 * and reads goal texts with Edge's grammar (services/tree.ts).
 */
export const notationDefinitionOf = (engine: TransformEngine) =>
  ENGINE_DEFINITIONS[isDefinedEngine(engine) ? engine : 'edge'];

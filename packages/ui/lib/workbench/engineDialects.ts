/**
 * The engines' definitions the workbench is built from (written with
 * @goal-controller/dialect, kept with their engines in @goal-controller/lib),
 * by workbench engine id: the one place an engine's definition is picked.
 */
import {
  edge,
  edgeCheckRegistry,
  edgeV2,
  type Check,
} from '@goal-controller/lib';
import type { TransformEngine } from '@/lib/types';

export const ENGINE_DIALECTS = { edge, edgev2: edgeV2 } as const;

export type DialectEngine = keyof typeof ENGINE_DIALECTS;

/**
 * The engine library's checks each definition names, by name: typed as the
 * registries are, so `specsFromDefinition` sees that each covers its
 * definition's checks.
 */
export const ENGINE_CHECKS = {
  edge: edgeCheckRegistry,
  edgev2: edgeCheckRegistry,
} as const satisfies Record<DialectEngine, Readonly<Record<string, Check>>>;

export const isDialectEngine = (
  engine: TransformEngine,
): engine is DialectEngine => engine in ENGINE_DIALECTS;

/**
 * The definition whose notation an engine's view shows: SLEEC has none of its own
 * and its view reads goal texts in Edge's dialect (services/tree.ts).
 */
export const notationDefinitionOf = (engine: TransformEngine) =>
  ENGINE_DIALECTS[isDialectEngine(engine) ? engine : 'edge'];

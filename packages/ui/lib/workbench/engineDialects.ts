/**
 * The engines' definitions the workbench is built from (written with
 * @goal-controller/dialect, kept with their engines in @goal-controller/lib),
 * by workbench engine id: the one place an engine's definition is picked.
 */
import {
  edge,
  edgeCheckRegistry,
  edgeGoalNames,
  edgeV2,
  edgeV2GoalNames,
  type Check,
} from '@goal-controller/lib';
import type { GoalNameParser } from '@goal-controller/goal-tree';
import type { TransformEngine } from '@/lib/types';

export const ENGINE_DIALECTS = { edge, edgev2: edgeV2 } as const;

export type DialectEngine = keyof typeof ENGINE_DIALECTS;

/** The engine library's checks each definition names, by name. */
export const ENGINE_CHECKS: Record<
  DialectEngine,
  Readonly<Record<string, Check>>
> = {
  edge: edgeCheckRegistry,
  edgev2: edgeCheckRegistry,
};

export const isDialectEngine = (
  engine: TransformEngine,
): engine is DialectEngine => engine in ENGINE_DIALECTS;

/**
 * The definition whose notation an engine's view shows: SLEEC has none of its own
 * and reads goal texts with Edge's grammar (services/tree.ts).
 */
export const notationDefinitionOf = (engine: TransformEngine) =>
  ENGINE_DIALECTS[isDialectEngine(engine) ? engine : 'edge'];

/** How an engine reads goal texts (the goal language, its definition's operators). */
export const goalNamesOf = (engine: TransformEngine): GoalNameParser =>
  engine === 'edgev2' ? edgeV2GoalNames : edgeGoalNames;

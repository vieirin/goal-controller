/**
 * GODA's engine mapper: a goal model's custom properties, as its model
 * reader takes them (`GoalImpl`, `PlanImpl`: `selected`, `creationProperty`),
 * and each element's bracket, read in GODA's dialect: a refined element's RT
 * regex, a leaf's cost.
 */
import { propertyKeys } from '@goal-controller/dialect';
import { parseElementLineIn } from '@goal-controller/goal-language';
import {
  createEngineMapper,
  type GoalNode,
  type GoalTreeType,
  type Task,
} from '@goal-controller/goal-tree';
import { isSelected } from './checks';
import { goda } from './definition';
import type { GodaGoalProps, GodaTaskProps } from './types';

export const GODA_GOAL_KEYS = propertyKeys(goda, 'goal');
export const GODA_TASK_KEYS = propertyKeys(goda, 'task');

/** A `creationProperty`'s conditions: GODA splits it at `%` (`addFulfillmentConditions`). */
const contextsOf = (text: string | undefined): string[] =>
  text?.trim() ? text.split('%').filter((part) => part.trim()) : [];

/** An element's text read in GODA's dialect (its bracket's spaces ignored). */
const readText = (text: string) => parseElementLineIn(goda, text).value;

export const godaEngineMapper = createEngineMapper<
  GodaGoalProps,
  GodaTaskProps,
  never
>()({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: goda,
  allowedGoalKeys: GODA_GOAL_KEYS,
  allowedTaskKeys: GODA_TASK_KEYS,
  skipResource: true,
  mapGoalProps: ({ raw, text }) => ({
    text,
    selected: isSelected(raw.selected),
    contexts: contextsOf(raw.creationProperty),
    annotation: readText(text)?.notation ?? null,
  }),
  mapTaskProps: ({ raw, text }) => {
    const read = readText(text);
    return {
      text,
      contexts: contextsOf(raw.creationProperty),
      annotation: read?.notation ?? null,
      cost: read?.cost ?? null,
    };
  },
});

export type GodaGoalNode = GoalNode<GodaGoalProps, GodaTaskProps, never>;
export type GodaTask = Task<GodaTaskProps, never>;
export type GodaGoalTree = GoalTreeType<GodaGoalProps, GodaTaskProps, never>;

/**
 * GODA's engine mapper: a goal model's custom properties, as its model
 * reader takes them (`GoalImpl`, `PlanImpl`: `selected`, `creationProperty`),
 * and each element's bracket, read in GODA's dialect: a refined element's RT
 * regex, a leaf's cost.
 */
import { propertyKeys, valueParts } from '@goal-controller/dialect';
import { parseElementLineIn } from '@goal-controller/goal-language';
import {
  createEngineMapper,
  useIstarDefaultNaming,
  type NodeOf,
} from '@goal-controller/goal-tree';
import { goda } from './definition';
import type { GodaGoalProps, GodaTaskProps } from './types';

export const GODA_GOAL_KEYS = propertyKeys(goda, 'goal');
export const GODA_TASK_KEYS = propertyKeys(goda, 'task');

/** `creationProperty`'s value: its conditions separated by `%` (#232). */
const CONTEXT = goda.properties.task.find(
  (property) => property.key === 'creationProperty',
)!.value;

/**
 * A `creationProperty`'s conditions as written (prefixes and spacing), which
 * the writers print (`//CTX_G1_T1_1 = (ctx=1)`). Gated on `props`: unset when
 * the dialect leaves the value unset (#232); otherwise each non-blank part.
 */
const contextsFrom = (
  props: { creationProperty?: unknown } | undefined,
  raw: string | undefined,
): string[] =>
  props?.creationProperty === undefined
    ? []
    : valueParts(CONTEXT, raw ?? '').map((part) => part.text);

/** An element's text read in GODA's dialect (its bracket's spaces ignored). */
const readText = (text: string) => parseElementLineIn(goda, text).value;

/**
 * GODA's mapper: the iStar reading, an entry per kind. Resource is ignored
 * (#215). `creationProperty` is gated on `props` (`Assertion[]`, #232).
 */
export const godaEngineMapper = createEngineMapper({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: goda,
  naming: useIstarDefaultNaming(),
  ignore: ['istar.Resource'],
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ kind, props, raw, text }): GodaGoalProps => {
        const annotation = readText(text)?.notation ?? null;
        // Quality has no properties in the dialect; Goal's keys need a narrow
        if (kind !== 'istar.Goal')
          return { text, selected: false, contexts: [], annotation };
        return {
          text,
          selected: props.selected === 'true',
          contexts: contextsFrom(props, raw.creationProperty),
          annotation,
        };
      },
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ props, raw, text }): GodaTaskProps => {
        const read = readText(text);
        return {
          text,
          contexts: contextsFrom(props, raw.creationProperty),
          annotation: read?.notation ?? null,
          cost: read?.cost ?? null,
        };
      },
    }),
  ],
});

export type GodaNode = NodeOf<typeof godaEngineMapper>;
export type GodaGoalNode = Extract<GodaNode, { type: 'goal' }>;
export type GodaTask = Extract<GodaNode, { type: 'task' }>;
export type GodaGoalTree = GodaNode[];

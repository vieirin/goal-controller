/**
 * SLEEC Engine Mapper
 * Maps raw iStar model properties to SLEEC engine-specific properties
 */
import {
  createEngineMapper,
  useIstarDefaultNaming,
  type NodeOf,
} from '@goal-controller/goal-tree';
import type { SleecGoalProps, SleecTaskProps } from './types';

/**
 * Allowed keys for SLEEC goal custom properties
 */
export const SLEEC_GOAL_KEYS = [
  'Type',
  'Source',
  'Class',
  'NormPrinciple',
  'Proxy',
  'AddedValue',
  'Condition',
  'Event',
  'ContextEvent',
] as const;

/**
 * Allowed keys for SLEEC task custom properties. The seeds write
 * `ObstacleEvent` (goal-controller#230); `FluentName` is documentation only.
 */
export const SLEEC_TASK_KEYS = [
  'PreCond',
  'TriggeringEvent',
  'TemporalConstraint',
  'PostCond',
  'ObstacleEvent',
] as const;

/**
 * Allowed keys for SLEEC Quality custom properties (also in SLEEC_GOAL_KEYS).
 * Examples put NormPrinciple/Proxy on the Quality "Autonomy".
 */
export const SLEEC_QUALITY_KEYS = ['NormPrinciple', 'Proxy'] as const;

/** SLEEC's properties, as goal-tree reads them: each key's value is text. */
const texts = <K extends string>(keys: readonly K[]) =>
  keys.map((key) => ({
    key,
    value: { type: 'text' as const },
    help: `its SLEEC ${key}`,
  }));

// Type aliases for the allowed keys
export type SleecGoalKey = (typeof SLEEC_GOAL_KEYS)[number];
export type SleecTaskKey = (typeof SLEEC_TASK_KEYS)[number];
export type SleecQualityKey = (typeof SLEEC_QUALITY_KEYS)[number];

/** A SLEEC element's properties as the mapper is given them: each `text`. */
type SleecRecord<K extends string> = {
  props: Partial<Record<K, string | null>>;
  raw: Partial<Record<K, string>>;
};

/**
 * The keys set, each as written: a key whose `text` reads as unset (empty
 * or blank) is left out, and the others keep their text untrimmed, as the
 * specification has always been given them.
 */
const written = <K extends string>(
  { props, raw }: SleecRecord<K>,
  keys: readonly K[],
): Partial<Record<K, string>> => {
  const values: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = props[key] == null ? undefined : raw[key];
    if (value !== undefined) values[key] = value;
  }
  return values;
};

const REQUIRED_TASK_KEYS = [
  'PreCond',
  'TriggeringEvent',
  'PostCond',
  'TemporalConstraint',
] as const;

const extractSleecTaskProps = (
  record: SleecRecord<SleecTaskKey>,
  taskName: string,
): SleecTaskProps => {
  const values = written(record, REQUIRED_TASK_KEYS);
  const { PreCond, TriggeringEvent, PostCond, TemporalConstraint } = values;
  if (
    PreCond === undefined ||
    TriggeringEvent === undefined ||
    PostCond === undefined ||
    TemporalConstraint === undefined
  ) {
    const missing = REQUIRED_TASK_KEYS.filter((key) => !(key in values));
    throw new Error(
      `Task "${taskName}" is missing required SLEEC properties: ${missing.join(', ')}. ` +
        `All tasks must define: ${REQUIRED_TASK_KEYS.join(', ')}.`,
    );
  }

  // an ObstacleEvent is set as every other key is: a blank one is unset, and
  // no rule _5 is written for it (#225, #230)
  const { ObstacleEvent } = written(record, ['ObstacleEvent'] as const);
  return {
    PreCond,
    TriggeringEvent,
    PostCond,
    TemporalConstraint,
    ...(ObstacleEvent && { ObstacleEvent }),
  };
};

/**
 * SLEEC Engine Mapper for creating SLEEC-compatible goal trees: the iStar
 * reading (goal-controller#215), goals' (and Qualities') and tasks' keys as
 * written; SLEEC reads no resource
 */
export const sleecEngineMapper = createEngineMapper({
  // no definition, no notation: goal texts give their ids and names only;
  // its properties are its keys, as text
  dialect: {
    name: 'SLEEC',
    properties: {
      goal: texts(SLEEC_GOAL_KEYS),
      task: texts(SLEEC_TASK_KEYS),
      quality: texts(SLEEC_QUALITY_KEYS),
    },
  },
  naming: useIstarDefaultNaming(),
  elements: (entry) => [
    // a quality is given its kind's keys only (NormPrinciple, Proxy)
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ props, raw }): SleecGoalProps =>
        written({ props, raw }, SLEEC_GOAL_KEYS),
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ props, raw, name }) =>
        extractSleecTaskProps({ props, raw }, name),
    }),
  ],
  ignore: ['istar.Resource'],
});

/** SLEEC's tree nodes, by kind: goals (and Qualities) and tasks. */
export type SleecNode = NodeOf<typeof sleecEngineMapper>;
export type SleecGoalNode = Extract<SleecNode, { type: 'goal' }>;
export type SleecTask = Extract<SleecNode, { type: 'task' }>;
export type SleecGoalTree = SleecNode[];

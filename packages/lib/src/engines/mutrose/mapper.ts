/**
 * MutRoSe's engine mapper: a goal model's custom properties, read as the
 * decomposer reads them (keys from the definition, values with its checks'
 * parsers), and each goal's runtime annotation as written.
 */
import { propertyKeys } from '@goal-controller/dialect';
import { parseElementLine } from '@goal-controller/goal-language';
import {
  createEngineMapper,
  type GoalNode,
  type GoalTreeType,
  type Task,
} from '@goal-controller/goal-tree';
import {
  mutroseCheckRegistry,
  parseCreationCondition,
  parseForAll,
  parseRobotNumber,
  parseSelect,
  parseVars,
} from './checks';
import { mutrose } from './definition';
import type {
  MutroseGoalProps,
  MutroseGoalType,
  MutroseTaskProps,
} from './types';

export const MUTROSE_GOAL_KEYS = propertyKeys(mutrose, 'goal');
export const MUTROSE_TASK_KEYS = propertyKeys(mutrose, 'task');

/**
 * The first message of the checks a kind's properties name, as the
 * decomposer would stop at it (with the element, for the Problems panel).
 */
const firstIssue = (
  kind: 'goal' | 'task',
  raw: Partial<Record<string, string>>,
  id: string,
): string | null => {
  for (const property of mutrose.properties[kind]) {
    if (!('check' in property) || raw[property.key] === undefined) continue;
    const message = mutroseCheckRegistry[property.check](raw, {
      self: id,
      kindOf: () => undefined,
    });
    if (message) return `${message} (node ${id})`;
  }
  return null;
};

const vars = (text: string | undefined) =>
  text?.trim() ? parseVars(text) : [];

/** Group, Divisible: anything but `false` (any case) is true. */
const flag = (text: string | undefined) =>
  text?.trim().toLowerCase() !== 'false';

const GOAL_TYPES: readonly MutroseGoalType[] = ['Perform', 'Achieve', 'Query'];

export const mutroseEngineMapper = createEngineMapper<
  MutroseGoalProps,
  MutroseTaskProps,
  never
>()({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: mutrose,
  allowedGoalKeys: MUTROSE_GOAL_KEYS,
  allowedTaskKeys: MUTROSE_TASK_KEYS,
  skipResource: true,
  // a Query goal fetches; it needs no children
  allowLeafGoals: true,
  mapGoalProps: ({ raw, id, text }) => {
    const issue = firstIssue('goal', raw, id);
    if (issue) throw new Error(issue);
    // the decomposer warns and reads Perform for an unknown type
    const goalType =
      GOAL_TYPES.find((type) => type === raw.GoalType?.trim()) ?? 'Perform';
    const achieve = raw.AchieveCondition?.trim();
    const query = raw.QueriedProperty?.trim();
    const creation = raw.CreationCondition?.trim();
    return {
      goalType,
      ...(raw.Description && { description: raw.Description }),
      controls: vars(raw.Controls),
      monitors: vars(raw.Monitors),
      ...(achieve && {
        achieveCondition: { forAll: parseForAll(achieve), text: achieve },
      }),
      ...(query && { queriedProperty: parseSelect(query)! }),
      ...(creation && { creationCondition: parseCreationCondition(creation)! }),
      group: flag(raw.Group),
      divisible: flag(raw.Divisible),
      annotation: parseElementLine(text).value?.notation ?? null,
    };
  },
  mapTaskProps: ({ raw, id }) => {
    const issue = firstIssue('task', raw, id);
    if (issue) throw new Error(issue);
    const robots = raw.RobotNumber?.trim();
    return {
      ...(raw.Description && { description: raw.Description }),
      ...(raw.Location?.trim() && { location: raw.Location.trim() }),
      params: raw.Params?.trim()
        ? raw.Params.split(',').map((name) => name.trim())
        : [],
      ...(robots && { robotNumber: parseRobotNumber(robots)! }),
    };
  },
});

export type MutroseGoalNode = GoalNode<
  MutroseGoalProps,
  MutroseTaskProps,
  never
>;
export type MutroseTask = Task<MutroseTaskProps, never>;
export type MutroseGoalTree = GoalTreeType<
  MutroseGoalProps,
  MutroseTaskProps,
  never
>;

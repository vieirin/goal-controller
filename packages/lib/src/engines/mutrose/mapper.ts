/**
 * MutRoSe's engine mapper: a goal model's custom properties, read as the
 * decomposer reads them (keys from the definition; GoalType, Group and
 * Divisible as its dialect types them, the OCL values, Description and
 * RobotNumber as written, with its checks' parsers), and each goal's runtime
 * annotation as written.
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
import type { CheckInput } from '../checks';
import { readNames } from './language';
import { mutrose } from './definition';
import type { MutroseGoalProps, MutroseTaskProps } from './types';

export const MUTROSE_GOAL_KEYS = propertyKeys(mutrose, 'goal');
export const MUTROSE_TASK_KEYS = propertyKeys(mutrose, 'task');

/**
 * The first message of the checks a kind's properties name, as the
 * decomposer would stop at it (with the element, for the Problems panel).
 */
const firstIssue = (
  kind: 'goal' | 'task',
  input: CheckInput,
  id: string,
): string | null => {
  for (const property of mutrose.properties[kind]) {
    if (!('check' in property) || input.raw[property.key] === undefined)
      continue;
    // run on every value written, read by the dialect or not: the mapper
    // reads the texts with MutRoSe's own language, and its checks say what
    // the decomposer would stop at
    const message = mutroseCheckRegistry[property.check](input, {
      self: id,
      kindOf: () => undefined,
    });
    if (message) return `${message} (node ${id})`;
  }
  return null;
};

const vars = (text: string | undefined) =>
  text?.trim() ? parseVars(text) : [];

export const mutroseEngineMapper = createEngineMapper<
  MutroseGoalProps,
  MutroseTaskProps,
  never
>()({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: mutrose,
  skipResource: true,
  // a Query goal fetches; it needs no children
  allowLeafGoals: true,
  mapGoalProps: ({ props, raw, id, text, kind }) => {
    const issue = firstIssue('goal', { props, raw, kind }, id);
    if (issue) throw new Error(issue);
    const achieve = raw.AchieveCondition?.trim();
    // its check rejects a padded or a blank one
    const query = raw.QueriedProperty;
    const creation = raw.CreationCondition?.trim();
    return {
      // the decomposer warns and reads Perform for an unknown type
      goalType: props.GoalType ?? 'Perform',
      ...(raw.Description && { description: raw.Description }),
      controls: vars(raw.Controls),
      monitors: vars(raw.Monitors),
      ...(achieve && {
        achieveCondition: { forAll: parseForAll(achieve), text: achieve },
      }),
      ...(query && { queriedProperty: parseSelect(query)! }),
      ...(creation && { creationCondition: parseCreationCondition(creation)! }),
      // an open, case-insensitive enum: `False` reads as `false`, and
      // anything but `false` is true, as the decomposer reads it
      group: props.Group !== 'false',
      divisible: props.Divisible !== 'false',
      annotation: parseElementLine(text).value?.notation ?? null,
    };
  },
  mapTaskProps: ({ props, raw, id, kind }) => {
    const issue = firstIssue('task', { props, raw, kind }, id);
    if (issue) throw new Error(issue);
    // its check rejects a padded or a blank one
    const robots = raw.RobotNumber;
    return {
      ...(raw.Description && { description: raw.Description }),
      ...(raw.Location?.trim() && { location: raw.Location.trim() }),
      params: readNames(raw.Params ?? '').value.map(({ item }) => item.text),
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

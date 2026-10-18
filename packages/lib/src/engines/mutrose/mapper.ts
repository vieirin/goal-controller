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
  useIstarDefaultNaming,
  type NodeOf,
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

/**
 * MutRoSe's mapper: the iStar reading, an entry per kind. A Query goal may
 * be a leaf (`leafGoals: 'allow'`); Resource is ignored (#215). A Quality
 * has no properties in the dialect (`quality: []`): narrow on `kind`.
 */
export const mutroseEngineMapper = createEngineMapper({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: mutrose,
  naming: useIstarDefaultNaming({ leafGoals: 'allow' }),
  ignore: ['istar.Resource'],
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ kind, props, raw, id, text }): MutroseGoalProps => {
        const annotation = parseElementLine(text).value?.notation ?? null;
        if (kind !== 'istar.Goal') {
          return {
            goalType: 'Perform',
            controls: [],
            monitors: [],
            group: true,
            divisible: true,
            annotation,
          };
        }
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
          ...(creation && {
            creationCondition: parseCreationCondition(creation)!,
          }),
          // an open, case-insensitive enum: `False` reads as `false`, and
          // anything but `false` is true, as the decomposer reads it
          group: props.Group !== 'false',
          divisible: props.Divisible !== 'false',
          annotation,
        };
      },
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ props, raw, id, kind }): MutroseTaskProps => {
        const issue = firstIssue('task', { props, raw, kind }, id);
        if (issue) throw new Error(issue);
        // its check rejects a padded or a blank one
        const robots = raw.RobotNumber;
        return {
          ...(raw.Description && { description: raw.Description }),
          ...(raw.Location?.trim() && { location: raw.Location.trim() }),
          params: readNames(raw.Params ?? '').value.map(
            ({ item }) => item.text,
          ),
          ...(robots && { robotNumber: parseRobotNumber(robots)! }),
        };
      },
    }),
  ],
});

export type MutroseNode = NodeOf<typeof mutroseEngineMapper>;
export type MutroseGoalNode = Extract<MutroseNode, { type: 'goal' }>;
export type MutroseTask = Extract<MutroseNode, { type: 'task' }>;
export type MutroseGoalTree = MutroseNode[];

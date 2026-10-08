/**
 * The custom properties the Edge engines read (edge, edgeV2 and edgeLangium
 * read the same keys and check them the same way today): one list per kind, in
 * the inspector's order. Checks are named; lib's check registry implements them.
 */
import type { PropertyDefinition } from '../schema';

const isMaintain = { when: { key: 'type', equals: 'maintain' } } as const;
const isInt = { when: { key: 'type', equals: 'int' } } as const;

const HELP = {
  maintain: 'the condition kept while a maintain goal is pursued',
  assertion: 'the condition under which the element may be pursued',
  dependsOn: 'the goals that must be achieved first (comma-separated ids)',
  variables: 'decision variables, `name:space` pairs separated by commas',
  utility: 'the utility reward of achieving it',
  cost: 'the cost reward of pursuing it',
  maxRetries: 'how many times it may be retried (a non-negative integer)',
  type: 'achieve (default) or maintain',
  root: 'marks the root goal',
} as const;

const CONDITION = { type: 'expression', language: 'assertion' } as const;

/** utility, cost: the same on goals and tasks, no engine check */
const REWARDS = [
  { key: 'utility', value: { type: 'number' }, help: HELP.utility },
  { key: 'cost', value: { type: 'number' }, help: HELP.cost },
] as const satisfies readonly PropertyDefinition[];

const BOUNDS_NOT_APPLYING =
  'Not used while type is {type} (bounds are for int resources)';

export const edgeProperties = {
  goal: [
    {
      key: 'type',
      value: {
        type: 'enum',
        options: [
          { value: '', label: 'achieve (default)' },
          { value: 'maintain', label: 'maintain' },
        ],
      },
      // always offered as a choice: unset is "achieve", the default
      required: 'always',
      help: HELP.type,
    },
    {
      key: 'maintain',
      value: CONDITION,
      input: { placeholder: 'condition kept while the goal is pursued' },
      applies: isMaintain,
      required: isMaintain,
      notApplying: 'Only read when type is maintain',
      help: HELP.maintain,
      check: 'edge.goal.maintain',
    },
    {
      key: 'assertion',
      value: CONDITION,
      input: { placeholder: 'condition, e.g. battery > 20' },
      required: isMaintain,
      help: HELP.assertion,
      check: 'edge.goal.assertion',
    },
    {
      key: 'maxRetries',
      value: { type: 'int', min: 0 },
      help: HELP.maxRetries,
      check: 'edge.goal.maxRetries',
    },
    ...REWARDS,
    {
      key: 'dependsOn',
      value: { type: 'refList', kind: 'goal', separator: ',' },
      input: { placeholder: 'goal ids, comma-separated: G2, G5' },
      help: HELP.dependsOn,
      check: 'edge.goal.dependsOn',
    },
    {
      key: 'variables',
      value: { type: 'pairList', separator: ',', pair: ':', value: 'int' },
      input: { placeholder: 'decision variables, name:space, …' },
      help: HELP.variables,
      check: 'edge.goal.variables',
    },
    // set by the diagram's root, not edited as a field
    { key: 'root', value: { type: 'text' }, help: HELP.root, inspector: false },
  ],
  task: [
    // tasks have no maintain condition (not a task key): type is free text
    { key: 'type', value: { type: 'text' }, help: HELP.type },
    {
      key: 'assertion',
      value: CONDITION,
      input: { placeholder: 'condition, e.g. battery > 20' },
      help: HELP.assertion,
    },
    {
      key: 'maxRetries',
      value: { type: 'int', min: 0 },
      help: HELP.maxRetries,
      check: 'edge.task.maxRetries',
    },
    ...REWARDS,
  ],
  resource: [
    {
      key: 'type',
      value: {
        type: 'enum',
        options: [
          { value: 'bool', label: 'bool' },
          { value: 'int', label: 'int' },
        ],
      },
      required: 'always',
      help: 'bool or int',
      check: 'edge.resource.type',
    },
    {
      key: 'initialValue',
      value: {
        when: isInt.when,
        matching: { type: 'int' },
        otherwise: { type: 'bool' },
      },
      required: 'always',
      help: 'the value it starts with (within the bounds, for an int)',
      check: 'edge.resource.initialValue',
    },
    {
      key: 'lowerBound',
      value: { type: 'int' },
      applies: isInt,
      required: isInt,
      notApplying: BOUNDS_NOT_APPLYING,
      help: 'the smallest value an int resource takes',
      check: 'edge.resource.lowerBound',
    },
    {
      key: 'upperBound',
      value: { type: 'int' },
      applies: isInt,
      required: isInt,
      notApplying: BOUNDS_NOT_APPLYING,
      help: 'the largest value an int resource takes',
      check: 'edge.resource.upperBound',
    },
  ],
  quality: [],
} as const satisfies Record<string, readonly PropertyDefinition[]>;

/** The order property lines are written in (goals and tasks alike). */
export const edgePropertyLineOrder = [
  'maintain',
  'assertion',
  'dependsOn',
  'variables',
  'utility',
  'cost',
  'maxRetries',
  'type',
  'root',
] as const;

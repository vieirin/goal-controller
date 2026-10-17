/**
 * The custom properties the Edge engines read (edge and edgeV2 read the
 * same keys and check them the same way today): one list per kind, in
 * the inspector's order. Checks are named; lib's check registry implements them.
 */
import { property } from '@goal-controller/dialect';
import type { EdgeCheckName } from './checks';

/** Its properties, their `check` one of the Edge checks (a misspelt one doesn't compile). */
const {
  assertion,
  conditional,
  enum: choice,
  int,
  number,
  pairList,
  refList,
  text,
} = property.for<EdgeCheckName>();

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

/** a condition over resources and the workbench's variables (`battery > 20 & !charging`) */
const CONDITION = { resolves: ['resource', 'variable'] } as const;

/** utility, cost: the same on goals and tasks, no engine check */
const REWARDS = [
  number('utility', { help: HELP.utility }),
  number('cost', { help: HELP.cost }),
];

const BOUNDS_NOT_APPLYING =
  'Not used while type is {type} (bounds are for int resources)';

export const edgeProperties = {
  goal: [
    choice(
      'type',
      [
        ['', 'achieve (default)'],
        ['maintain', 'maintain'],
      ],
      // always offered as a choice: unset is "achieve", the default
      { required: 'always', help: HELP.type },
    ),
    assertion('maintain', {
      ...CONDITION,
      input: { placeholder: 'condition kept while the goal is pursued' },
      applies: isMaintain,
      required: isMaintain,
      notApplying: 'Only read when type is maintain',
      help: HELP.maintain,
      check: 'edge.goal.maintain',
    }),
    assertion('assertion', {
      ...CONDITION,
      input: { placeholder: 'condition, e.g. battery > 20' },
      required: isMaintain,
      help: HELP.assertion,
      check: 'edge.goal.assertion',
    }),
    int('maxRetries', {
      min: 0,
      help: HELP.maxRetries,
      check: 'edge.goal.maxRetries',
    }),
    ...REWARDS,
    refList('dependsOn', 'goal', {
      input: { placeholder: 'goal ids, comma-separated: G2, G5' },
      help: HELP.dependsOn,
      check: 'edge.goal.dependsOn',
    }),
    pairList('variables', 'int', {
      input: { placeholder: 'decision variables, name:space, …' },
      help: HELP.variables,
    }),
    // set by the diagram's root, not edited as a field
    text('root', { help: HELP.root, inspector: false }),
  ],
  task: [
    // tasks have no maintain condition (not a task key): type is free text
    text('type', { help: HELP.type }),
    assertion('assertion', {
      ...CONDITION,
      input: { placeholder: 'condition, e.g. battery > 20' },
      help: HELP.assertion,
    }),
    int('maxRetries', {
      min: 0,
      help: HELP.maxRetries,
      check: 'edge.task.maxRetries',
    }),
    ...REWARDS,
  ],
  resource: [
    choice('type', ['bool', 'int'], {
      required: 'always',
      help: 'bool or int',
      check: 'edge.resource.type',
    }),
    conditional(
      'initialValue',
      {
        when: isInt.when,
        matching: { type: 'int' },
        otherwise: { type: 'bool' },
      },
      {
        required: 'always',
        help: 'the value it starts with (within the bounds, for an int)',
        check: 'edge.resource.initialValue',
      },
    ),
    int('lowerBound', {
      applies: isInt,
      required: isInt,
      notApplying: BOUNDS_NOT_APPLYING,
      help: 'the smallest value an int resource takes',
      check: 'edge.resource.lowerBound',
    }),
    int('upperBound', {
      applies: isInt,
      required: isInt,
      notApplying: BOUNDS_NOT_APPLYING,
      help: 'the largest value an int resource takes',
      check: 'edge.resource.upperBound',
    }),
  ],
  quality: [],
};

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

/**
 * iStar-DT (Liaskos et al., ER 2024 as iStar-RL, DKE 2026): iStar 2.0's
 * goals, tasks, AND/OR refinement and qualities, with the effects a task
 * may have, condition boxes, domain predicates and variables as the
 * `istardt` extension's kinds (./extension), and what a decision-theoretic
 * model needs: a root goal with its episode length, a root quality (the
 * reward) given by a formula, probabilities, precedence, and the sets an
 * RL agent observes and carries from run to run (goal-controller#117,
 * #119).
 *
 * - Ids (#117 D1): goals and tasks are `G1`, `T1` (the goal language's);
 *   qualities and the extension's kinds `Q1`, `E1`, `C1`, `P1`, `V1` in
 *   their text, on kinds the Notation view doesn't list. The name DT-Golog
 *   gives an element is its `identifier`, or its name in camelCase.
 * - No notation: iStar-DT writes no `[…]`; a decomposition is its
 *   refinement links.
 * - Formulas name elements by their identifier, as the file does (#117 D6).
 * - The extension's kinds can't declare properties yet (the schema keys
 *   them by `goal | task | resource | quality`, #117 D7): what they have is
 *   `extensionProperties`, read and checked by the engine (`istardtProblems`).
 */
import {
  defineDialect,
  type PropertyDefinition,
} from '@goal-controller/dialect';
import type { IstardtCheckName } from './checks';
import { SET_KEYS } from './model';
import { ISTARDT_KINDS, ISTARDT_LINKS } from './vocabulary';
import { PREVIOUS } from './template/formulas';

type IstardtProperty = PropertyDefinition<IstardtCheckName>;

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

const IS_ROOT = { when: { key: 'root', equals: 'true' } } as const;

/** the name DT-Golog gives an element, where it isn't its name in camelCase */
const IDENTIFIER = {
  key: 'identifier',
  value: { type: 'text' },
  help: 'the name DT-Golog gives it, where it isn’t its name in camelCase (the iStarDT-X file’s name)',
} as const satisfies IstardtProperty;

/** a continuous export's range (the exported set is the actor's) */
const EXPORT_BOUNDS = [
  {
    key: 'exportMin',
    value: { type: 'number' },
    help: 'the least value the RL agent observes, when it is exported',
    check: 'istardt.export.bounds',
  },
  {
    key: 'exportMax',
    value: { type: 'number' },
    help: 'the greatest value the RL agent observes, when it is exported',
    check: 'istardt.export.bounds',
  },
] as const satisfies readonly IstardtProperty[];

const previous = [{ name: PREVIOUS, arity: 1 }] as const;

export const istardt = defineDialect({
  id: 'istardt',
  name: 'iStar-DT',
  elements: {
    goal: { prefix: 'G', fill: DEFAULT_FILL },
    task: { prefix: 'T', fill: DEFAULT_FILL },
  },
  defaultFill: DEFAULT_FILL,
  notation: {
    operand: { kinds: ['goal', 'task'] },
    operators: {},
    constructs: {
      and: {
        label: 'And',
        help: 'every child, in any order (DT-Golog’s `:`, one procedure per order)',
        relation: 'and',
      },
      or: {
        label: 'Or',
        help: 'one of its children (DT-Golog’s `#`): the others aren’t attempted',
        relation: 'or',
      },
    },
    defaultConstruct: { and: 'and', or: 'or' },
    // the file's descriptions are free text (`Assign to Subcontractor A`)
    names: 'text',
  },
  properties: {
    goal: [
      {
        key: 'root',
        value: { type: 'bool' },
        help: 'the goal an episode is for (one per model)',
        check: 'istardt.goal.root',
      },
      {
        key: 'episodeLength',
        value: { type: 'int', min: 1 },
        applies: IS_ROOT,
        notApplying:
          'Only the root goal has an episode length (root is {root})',
        help: 'how many runs an episode has',
      },
      {
        key: 'terminal',
        value: { type: 'bool' },
        help: 'whether satisfying it ends the run (read, not yet written: dtx2dtg writes nothing for it)',
      },
      IDENTIFIER,
    ],
    task: [IDENTIFIER],
    resource: [],
    quality: [
      {
        key: 'formula',
        value: { type: 'expression', functions: previous },
        help: 'its value: numbers, + - * /, the identifiers of qualities, predicates, variables, conditions, goals, tasks and effects, and previous(x) for x’s value in the previous state',
        required: 'always',
      },
      {
        key: 'root',
        value: { type: 'bool' },
        help: 'the reward: the quality the RL agent maximises (one per model)',
      },
      ...EXPORT_BOUNDS,
      IDENTIFIER,
    ],
  },
  propertyLineOrder: ['root', 'episodeLength', 'terminal', 'identifier'],
  indent: '  ',
  links: {
    [ISTARDT_LINKS.utility]: [
      {
        key: 'weight',
        value: { type: 'number' },
        help: 'what the effect adds to the quality: weight × whether it happened (read when the quality has no formula)',
      },
    ],
  },
  actors: [
    {
      key: SET_KEYS.crossRun,
      value: { type: 'text' },
      input: { placeholder: 'cost, roomTemperature, hvacOn' },
      help: 'the predicates, conditions, variables and qualities carried to the next run: identifiers, in order',
    },
    {
      key: SET_KEYS.exported,
      value: { type: 'text' },
      input: { placeholder: 'deliveredInTimeA, roomTemperature' },
      help: 'what the RL agent observes: goals, tasks and predicates (discrete), qualities and variables (continuous, with their exportMin and exportMax): identifiers, in order',
    },
    {
      key: SET_KEYS.initializations,
      value: { type: 'pairList', value: 'text' },
      input: { placeholder: 'cost:0, roomTemperature:30' },
      help: 'each quality’s, variable’s or predicate’s value at the start, in order',
    },
  ],
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the decomposition',
    },
    relationMismatch: {
      severity: 'error',
      message:
        '{construct} needs {needs} refinement links, but this element is refined with {relation} links',
    },
    notInDiagram: {
      severity: 'error',
      message: 'Add this element in the diagram',
    },
  },
});

/**
 * What the extension's kinds would declare (#117 D7: not declarable yet).
 * Kept in their custom properties as written here; the engine reads and
 * checks them.
 */
export const extensionProperties = {
  [ISTARDT_KINDS.effect]: [
    {
      key: 'probability',
      value: { type: 'number' },
      help: 'how likely it is when its task is performed, 0..1 (its task’s effects sum to 1)',
    },
    {
      key: 'satisfying',
      value: { type: 'bool' },
      help: 'whether it satisfies its task (default: true)',
    },
    {
      key: 'turnsTrue',
      value: { type: 'text' },
      help: 'the predicates it makes true: identifiers, comma-separated',
    },
    {
      key: 'turnsFalse',
      value: { type: 'text' },
      help: 'the predicates it makes false: identifiers, comma-separated',
    },
    {
      key: 'set',
      value: { type: 'pairList', value: 'number' },
      help: 'the variables it sets, and to what: `name:value`, comma-separated',
    },
    IDENTIFIER,
  ],
  [ISTARDT_KINDS.condition]: [
    {
      key: 'formula',
      value: {
        type: 'assertion',
        resolves: ['variable'],
        declaresVariables: true,
        decimals: true,
        functions: previous,
      },
      help: 'when it holds: & (and), | (or), !(…), comparisons, the identifiers of predicates, goals, tasks, effects and conditions, previous(x)',
    },
    IDENTIFIER,
  ],
  [ISTARDT_KINDS.predicate]: [...EXPORT_BOUNDS, IDENTIFIER],
  [ISTARDT_KINDS.variable]: [...EXPORT_BOUNDS, IDENTIFIER],
} as const satisfies Record<string, readonly IstardtProperty[]>;

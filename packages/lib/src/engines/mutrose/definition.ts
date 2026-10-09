/**
 * MutRoSe (the mission decomposer, github.com/ericbg27/MutRoSe-Mission-Decomposer):
 * goals `G1` and abstract tasks `AT1`, the custom properties its goal model
 * reader takes (`gm/gm.cpp`, `utils/gm_utils.hpp`), and its runtime
 * annotations (`rannot/rannot.y`): `;` sequential, `#` parallel (tighter, as
 * the goal language binds it) and `FALLBACK(a,b)`.
 */
import {
  defineDialect,
  type PropertyDefinition,
} from '@goal-controller/dialect';
import type { MutroseCheckName } from './checks';

/** A property whose `check` is one of MutRoSe's checks (a misspelt one doesn't compile). */
type MutroseProperty = PropertyDefinition<MutroseCheckName>;

/** The default fill of an intentional element (the istar-ts canvas, as piStar). */
const DEFAULT_FILL = '#CDFECD';

const isAchieve = { when: { key: 'GoalType', equals: 'Achieve' } } as const;
const isQuery = { when: { key: 'GoalType', equals: 'Query' } } as const;

/** Group, Divisible: `true` by default; any other text than `false` reads as true. */
const FLAG = {
  type: 'enum',
  options: [
    { value: '', label: 'true (default)' },
    { value: 'true', label: 'true' },
    { value: 'false', label: 'false' },
  ],
  // the decomposer reads `False`, `TRUE`: any case
  open: true,
} as const;

const DESCRIPTION = {
  key: 'Description',
  value: { type: 'text' },
  help: 'what it is for (not read by the decomposer)',
} as const satisfies MutroseProperty;

const goalProperties = [
  {
    key: 'GoalType',
    value: {
      type: 'enum',
      options: [
        { value: '', label: 'Perform (default)' },
        { value: 'Perform', label: 'Perform' },
        { value: 'Achieve', label: 'Achieve' },
        { value: 'Query', label: 'Query' },
      ],
    },
    required: 'always',
    help: 'Perform (default) does its children; Achieve holds its AchieveCondition; Query fetches its QueriedProperty',
  },
  DESCRIPTION,
  {
    key: 'Controls',
    value: { type: 'text' },
    input: { placeholder: 'current_room : Room, rooms : Sequence(Room)' },
    help: 'the variables it declares, `name : Type` comma-separated (`Sequence(T)` for a collection)',
    check: 'mutrose.goal.controls',
  },
  {
    key: 'Monitors',
    value: { type: 'text' },
    input: { placeholder: 'current_room, rooms' },
    help: 'the variables it reads, declared by an earlier goal’s Controls',
    check: 'mutrose.goal.monitors',
  },
  {
    key: 'AchieveCondition',
    value: { type: 'text' },
    input: { placeholder: 'rooms->forAll(r | r.is_clean)' },
    applies: isAchieve,
    required: isAchieve,
    notApplying: 'Only read when GoalType is Achieve (it is {GoalType})',
    help: 'the condition it achieves: `coll->forAll(it | condition)`, or a condition',
    check: 'mutrose.goal.achieveCondition',
  },
  {
    key: 'QueriedProperty',
    value: { type: 'text' },
    input: { placeholder: 'world_db->select(r:Room | r.is_dirty)' },
    applies: isQuery,
    required: isQuery,
    notApplying: 'Only read when GoalType is Query (it is {GoalType})',
    help: 'what it fetches: `source->select(v:Type | condition)`',
    check: 'mutrose.goal.queriedProperty',
  },
  {
    key: 'CreationCondition',
    value: { type: 'text' },
    input: { placeholder: 'assertion condition "r.is_dirty"' },
    help: 'when it is created: `assertion condition "expr"` or `assertion trigger "Event"`',
    check: 'mutrose.goal.creationCondition',
  },
  {
    key: 'Group',
    value: FLAG,
    help: 'whether a team of robots may pursue it (default true)',
  },
  {
    key: 'Divisible',
    value: FLAG,
    help: 'whether its tasks may be split between robots (default true)',
  },
] as const satisfies readonly MutroseProperty[];

const taskProperties = [
  DESCRIPTION,
  {
    key: 'Location',
    value: { type: 'text' },
    input: { placeholder: 'current_room' },
    help: 'the variable naming where it is done',
    check: 'mutrose.task.location',
  },
  {
    key: 'Params',
    value: { type: 'text' },
    input: { placeholder: 'current_room, current_nurse' },
    help: 'the variables passed to its HDDL task, comma-separated',
    check: 'mutrose.task.params',
  },
  {
    key: 'RobotNumber',
    value: { type: 'text' },
    input: { placeholder: '2, or [1,3]' },
    help: 'how many robots: a number or a range `[lo,hi]` (default: from the HDDL task)',
    check: 'mutrose.task.robotNumber',
  },
] as const satisfies readonly MutroseProperty[];

export const mutrose = defineDialect({
  id: 'mutrose',
  name: 'MutRoSe',
  elements: {
    goal: { prefix: 'G', fill: DEFAULT_FILL },
    task: { prefix: 'AT', fill: DEFAULT_FILL },
  },
  defaultFill: DEFAULT_FILL,
  notation: {
    operand: { kinds: ['goal', 'task'] },
    operators: { ';': 'sequential', '#': 'parallel', FALLBACK: 'fallback' },
    constructs: {
      sequential: {
        label: 'Sequential',
        help: 'does its operands one after another',
        // the decomposer rejects it on an OR-refined goal
        relation: 'and',
      },
      parallel: {
        label: 'Parallel',
        help: 'does its operands at the same time',
      },
      fallback: {
        label: 'Fallback',
        help: 'does the first operand; if it fails, the second',
        relation: 'and',
      },
    },
    // without an annotation, a goal's children run in parallel
    defaultConstruct: { and: 'parallel', or: 'parallel' },
  },
  properties: { goal: goalProperties, task: taskProperties },
  propertyLineOrder: [
    'GoalType',
    'Description',
    'Controls',
    'Monitors',
    'AchieveCondition',
    'QueriedProperty',
    'CreationCondition',
    'Group',
    'Divisible',
    'Location',
    'Params',
    'RobotNumber',
  ],
  indent: '  ',
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this goal' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the runtime annotation',
    },
    relationMismatch: {
      severity: 'error',
      message:
        '{construct} needs {needs} refinement links, but this goal is refined with {relation} links (MutRoSe rejects it)',
    },
    notInDiagram: {
      severity: 'error',
      message: 'Add this element in the diagram',
    },
  },
});

/**
 * Tropos4AS (Morandini, Penserini, Perini; FBK, 2008–2017): Tropos goal
 * models, iStar 2.0's goals, plans (tasks), resources and softgoals
 * (qualities), AND/OR refinement, means-end (a task refining a goal) and
 * contribution, made to run: each goal has a type and the conditions its
 * type evaluates, which an agent's lifecycle reads at run time (AAMAS 2009
 * §3–4), over the artifacts of the actor's environment; and a failure model
 * (#134 D2). The lifecycle is the analysis (./lifecycle).
 *
 * - No ids: an element's text is its name, as the papers' figures write it
 *   (the seeds reproduce them); scenarios and traces name elements by their
 *   piStar ids (`RC`, `DC`, `WC` in the Cleaner Agent, as §5 abbreviates).
 * - No operators: a decomposition is its refinement links.
 * - Conditions are assertions in the goal language (#134 D3), over the
 *   artifacts' attributes and variables declared by their use. Until member
 *   references land (#135) they name bare variables (`roomClean`, not
 *   `room.clean`).
 */
import { defineDialect, property } from '@goal-controller/dialect';
import type { Tropos4asCheckName } from './checks';
import { tropos4asExtension } from './extension';
import { GOAL_TYPES, TROPOS4AS_KINDS } from './vocabulary';

const {
  assertion,
  enum: choice,
  pairList,
} = property.for<Tropos4asCheckName>();

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

/** a condition: read in the belief base, over artifacts and variables */
const CONDITION = {
  resolves: [TROPOS4AS_KINDS.artifact, 'variable'],
  decimals: true,
  booleanInequality: true,
  declaresVariables: true,
} as const;

const NOT_MAINTAIN = {
  not: { when: { key: 'type', equals: 'maintain' } },
} as const;
const MAINTAIN = { when: { key: 'type', equals: 'maintain' } } as const;

export const tropos4as = defineDialect({
  id: 'tropos4as',
  name: 'Tropos4AS',
  // its artifacts, failures, errors and symptoms (./extension)
  extension: tropos4asExtension,
  // no ids: an element's text is its name as the papers draw it
  // (`RoomClean`), so no kind is listed (none has a line) and every kind's
  // properties are the inspector's (as GRL's indicator's are); scenarios and
  // traces name elements by their piStar ids
  elements: {},
  defaultFill: DEFAULT_FILL,
  notation: {
    operand: { kinds: ['goal', 'task'] },
    operators: {},
    constructs: {
      and: {
        label: 'And',
        help: 'pursues every child: fails at the first that fails (AAMAS 2009 §4.2.2)',
        relation: 'and',
      },
      or: {
        label: 'Or',
        help: 'pursues its children until one succeeds (AAMAS 2009 §4.2.2)',
        relation: 'or',
      },
    },
    defaultConstruct: { and: 'and', or: 'or' },
    // the papers' goal names are words and digits (`take medicine before 8PM`)
    names: 'text',
  },
  properties: {
    goal: [
      choice(
        'type',
        GOAL_TYPES.map((type) =>
          type === 'achieve' ? (['', 'achieve (default)'] as const) : type,
        ),
        {
          help: 'achieve: reach a state (its achievement condition); maintain: keep one, acting when it is violated; perform: pursue its children, no conditions (AAMAS 2009 §3)',
        },
      ),
      assertion('creation', {
        ...CONDITION,
        help: 'when the agent adopts it: root goals only (AAMAS 2009 fn. 1); none, from the start',
      }),
      assertion('achievement', {
        ...CONDITION,
        applies: NOT_MAINTAIN,
        notApplying:
          'A maintain-goal has a maintain condition (type is {type})',
        help: 'its success condition s: once it holds, the goal succeeds, whatever its subgoals did (A(s, f), §4.3.2)',
        check: 'tropos4as.goal.perform',
      }),
      assertion('failure', {
        ...CONDITION,
        applies: NOT_MAINTAIN,
        notApplying: 'A maintain-goal has a drop condition (type is {type})',
        help: 'its failure (drop) condition f: once it holds, the goal fails; it wins over success (§4.3.2)',
        check: 'tropos4as.goal.perform',
      }),
      choice('onFailure', [['', 'restart (default)'], 'drop'], {
        applies: NOT_MAINTAIN,
        notApplying: 'Only an achieve-goal restarts or drops (type is {type})',
        help: 'when its subgoals are done and s is still false: restart them (behaviour a, ⟨¬s, Reactivate⟩) or fail (b, ⟨¬s, DropFailure⟩), §4.3.2',
      }),
      assertion('maintain', {
        ...CONDITION,
        applies: MAINTAIN,
        notApplying:
          'Only a maintain-goal has a maintain condition (type is {type})',
        help: 'the state m it keeps: the goal activates when m is false, and suspends when it holds (M(m, d), §4.3.3)',
      }),
      assertion('target', {
        ...CONDITION,
        applies: MAINTAIN,
        notApplying: 'Only a maintain-goal has a target (type is {type})',
        help: 'where it stops acting, past m: it activates when m is false and suspends only when t holds, a hysteresis ("heat till 22 °C", M(m, t, d), §4.3.3)',
        check: 'tropos4as.goal.target',
      }),
      assertion('drop', {
        ...CONDITION,
        applies: MAINTAIN,
        notApplying:
          'Only a maintain-goal has a drop condition (type is {type})',
        help: 'when the agent drops it, as failed (d, §4.3.3)',
      }),
      assertion('precondition', {
        ...CONDITION,
        help: 'what must hold before it is pursued (iStar 2011 Fig. 1’s `precond`); AAMAS 2009’s rules have none, so the lifecycle doesn’t read it',
      }),
    ],
    task: [],
    resource: [],
    quality: [],
    'tropos4as.Artifact': [
      pairList('attributes', 'text', {
        input: { placeholder: 'clean:bool, temperature:number, mode:wet|dry' },
        help: 'what the conditions read of it: `name:type`, the type bool, int, number or its options (`mode:wet|dry`)',
        check: 'tropos4as.artifact.attributes',
      }),
    ],
    'tropos4as.Error': [
      assertion('condition', {
        ...CONDITION,
        required: 'always',
        help: 'when it holds, the agent adopts the error as a goal, its recovery tasks the means (its creation condition, #134 D7)',
      }),
    ],
  },
  // no kind has a line: no property lines
  propertyLineOrder: [],
  indent: '  ',
  // a goal's lifecycle runs in its actor; an agent per actor, every tree
  model: { actors: 'many', treesPerActor: 'many' },
  projectResources: {
    scenarios: {
      label: 'Scenarios',
      format: 'json',
      many: true,
      role: 'scenarios',
      path: 'scenarios/',
      accept: ['.json'],
      help: 'one file per scenario: its steps, each what the agent comes to believe and how the subgoals it pursues turn out',
    },
  },
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

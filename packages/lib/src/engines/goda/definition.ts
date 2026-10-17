/**
 * GODA-MDP (lesunb/pistarGODA-MDP, Solano et al., SEAMS 2019): goals `G1`,
 * tasks `T1.1` whose ids are scoped by their goal (`G3_T1_1`), the custom
 * properties its model reader takes (`selected`, `creationProperty`), and its
 * RT regex (`RTRegex.g4`) as far as the MDP generator reads it: decision
 * making, `DM(T1.1,T1.2)`, any number of operands. A leaf's bracket is its
 * cost (`CostRegex.g4`: `W = 0.1`, `W = 0.1x`, `W = x`), and the spaces in a
 * bracket are not read (`removeBlankSpaceInBrackets`).
 */
import {
  defineDialect,
  element,
  notation,
  property,
} from '@goal-controller/dialect';
import type { GodaCheckName } from './checks';

/** Its properties, their `check` one of GODA's checks (a misspelt one doesn't compile). */
const { assertion, enum: choice } = property.for<GodaCheckName>();

/** The default fill of an intentional element (the istar-ts canvas, as piStar). */
const DEFAULT_FILL = '#CDFECD';

/** CtxRegex.g4: `assertion condition` or `assertion trigger`, then the condition. */
const CONTEXT = assertion('creationProperty', {
  resolves: ['variable'],
  prefixes: ['assertion condition', 'assertion trigger'],
  decimals: true,
  booleanInequality: true,
  // CtxRegex.g4's VARs are the context's meta-variables, declared by use (#34 D17)
  declaresVariables: true,
  // several contexts are separated by `%` (addFulfillmentConditions, #232)
  separator: '%',
  input: { placeholder: 'assertion trigger battery > 0.5' },
  help: 'the context it is pursued in: `assertion condition` or `assertion trigger`, then a condition on context variables',
});

const goalProperties = [
  choice(
    'selected',
    [
      ['', 'not selected'],
      ['true', 'true'],
      // what GODA's own models write for not selected (#232)
      ['false', 'not selected'],
    ],
    {
      help: 'the goal the model is generated from: exactly one goal is selected',
      check: 'goda.goal.selected',
    },
  ),
  CONTEXT,
];

const taskProperties = [CONTEXT];

export const goda = defineDialect({
  id: 'goda',
  name: 'GODA',
  elements: {
    goal: element('G', { fill: DEFAULT_FILL }),
    task: element('T', { fill: DEFAULT_FILL }),
    // read and left out (TAS draws some)
    resource: element('R', { fill: DEFAULT_FILL }),
  },
  defaultFill: DEFAULT_FILL,
  notation: notation({
    operand: { kinds: ['goal', 'task'] },
    // RTRegex.g4 also has `;`, `@n`, `try(a)?b:c` and `skip`. The MDP
    // generator the references come from reads decision making only (its
    // formulas read any annotation as one); `#` is read for SA-BSN, whose
    // runtime formulas compose it as a parallel AND (goal-controller#94)
    operators: { DM: 'decisionMaking', '#': 'parallel' },
    constructs: {
      and: { label: 'And', help: 'pursues every child', relation: 'and' },
      or: {
        label: 'Or',
        help: 'pursues its children until one succeeds',
        relation: 'or',
      },
      decisionMaking: {
        label: 'Decision making',
        help: 'chooses which operands to pursue, by the context each one needs',
      },
      // upstream has a parallel AND and a parallel OR (PARAMProducer, 2019-12)
      parallel: {
        label: 'Parallel',
        help: 'pursues its operands at the same time',
      },
    },
    // without an annotation, a goal pursues its children as its links say
    defaultConstruct: { and: 'and', or: 'or' },
    leafBracket: 'cost',
    whitespace: 'ignore',
    // GODA's producer splits a line at its colon: a name may hold digits (TAS, BSN)
    names: 'text',
  }),
  idScope: 'ancestorGoal',
  // TAS draws its Resources beside the goals, linked to nothing and without ids
  unlinkedResources: 'ignore',
  idlessElements: 'unlisted',
  // a model of several actors names the one holding the selected goal (#34
  // D16): it generates from that actor's one tree (goal-controller#125)
  model: { actors: 'many', treesPerActor: 'one' },
  // it reads no resource or quality properties
  properties: {
    goal: goalProperties,
    task: taskProperties,
    resource: [],
    quality: [],
  },
  propertyLineOrder: ['selected', 'creationProperty'],
  indent: '  ',
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the decision',
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

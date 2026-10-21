/**
 * kaossim's dialect (goal-controller#193, D1): kaosprop's, with the
 * quantities of Letier and van Lamsweerde's partial goal satisfaction
 * (FSE'04, DOI 10.1145/1029894.1029905) and Heaven and Letier's simulation
 * and design-space search (RE'11, DOI 10.1109/RE.2011.6051653). The encoding
 * is logged on #189 ("#193 D1"):
 *
 * - on a goal, its **quality variables** (FSE'04 §3.1), one set of keys per
 *   variable, keyed by its name (`QualityVariable[ResponseTime]`): its sort
 *   (`Time`, in seconds, `Boolean`, `Number`), its sample space and its
 *   definition; and a leaf variable's estimate, `Distribution[v]`;
 * - on a goal, its **objective functions** (FSE'04 §3.1), keyed by name: the
 *   definition, `Objective[o]` (an assertion, the objective is its
 *   probability, `P(ResponseTime <= 8 * 60)`) or `Mean[o]` (an expression,
 *   its expectation), `Modal[o]` (Max, Min), `Target[o]` and `Current[o]`,
 *   and its formal definition, `ObjectiveSpec[o]`, a `formula` in PCTL
 *   (§3.3's patterns), which nothing checks yet;
 * - on a refinement (its hub), the **refinement equations** (FSE'04 §4.1):
 *   `Equation[v]` (an expression over variables; a Boolean is 0 or 1,
 *   `if(c, a, b)`, `min`, `max`), `BooleanEquation[v]` (an assertion over
 *   them), or `Distribution[v]` (an equation that is a distribution, §4.1's
 *   "in terms of probability distribution functions"); its `SysRef` (the
 *   `kaos` dialect's) is the **option** it is (RE'11 §II, D2);
 * - on a responsibility assignment, its `SysRef` (an OR-assignment's
 *   option, D2) and the responsible agent's estimates, `Distribution[v]`.
 *
 * A goal refined several ways, or assigned to several agents, is a decision
 * point; a design picks one option of each (the `design` project resource,
 * ./designs.ts). Every key is keyed by names the model writes (no resource
 * lists them). The plain `kaos` dialect and kaosprop's keep them as unknown
 * keys, untouched.
 */
import {
  defineDialect,
  links,
  property,
  type FunctionDefinition,
  type WrittenTarget,
} from '@goal-controller/dialect';
import { kaosprop } from '../kaosprop/definition';

/** A quality variable's sort (FSE'04 §3.1): a time in seconds, a truth value, a number. */
export const QUALITY_SORTS = ['Time', 'Boolean', 'Number'] as const;
export type QualitySort = (typeof QUALITY_SORTS)[number];

/** An objective function's modality (FSE'04 §3.1). */
export const MODALS = ['Max', 'Min'] as const;
export type Modal = (typeof MODALS)[number];

/** What an equation may call: a conditional (on a Boolean, 0 or 1), and the smaller and larger of two. */
export const EQUATION_FUNCTIONS = [
  { name: 'if', arity: 3 },
  { name: 'min', arity: 2 },
  { name: 'max', arity: 2 },
] as const satisfies readonly FunctionDefinition[];

const WRITTEN: WrittenTarget = { written: true };

const distribution = (help: string) =>
  property.distribution('Distribution', {
    point: true,
    range: 'real',
    keyed: WRITTEN,
    help,
  });

const GOAL = [
  property.enum('QualityVariable', ['', ...QUALITY_SORTS], {
    keyed: WRITTEN,
    help: 'a quality variable of the goal, by its name (QualityVariable[ResponseTime]): its sort, Time (seconds), Boolean or Number (FSE’04 §3.1)',
  }),
  property.text('SampleSpace', {
    keyed: WRITTEN,
    help: 'a quality variable’s sample space, by its name: what one sample is (the set of reported incidents)',
  }),
  property.text('QualityDefinition', {
    keyed: WRITTEN,
    help: 'a quality variable’s definition, by its name: the quantity it denotes in the domain',
  }),
  distribution(
    'a leaf quality variable’s estimate, by its name: a value or a distribution (exponential[60], normal[0, 120]), in every design',
  ),
  property.assertion('Objective', {
    keyed: WRITTEN,
    resolves: [],
    functions: [],
    help: 'an objective function, by its name (Objective[8MinRespRate]): the condition whose probability it is (ResponseTime <= 8 * 60)',
  }),
  property.expression('Mean', {
    keyed: WRITTEN,
    functions: EQUATION_FUNCTIONS,
    help: 'an objective function, by its name, that is an expectation: the expression whose mean it is (ResponseTime)',
  }),
  property.formula('ObjectiveSpec', 'pctl', {
    keyed: WRITTEN,
    help: 'an objective function’s formal definition, by its name, in PCTL (FSE’04 §3.3: C ⇒ Pr≥p ◇≤d T); nothing checks it yet',
  }),
  property.enum('Modal', ['', ...MODALS], {
    keyed: WRITTEN,
    help: 'an objective function’s modality, by its name: Max or Min',
  }),
  property.probability('Target', {
    keyed: WRITTEN,
    help: 'an objective function’s target for the system-to-be, by its name (50%)',
  }),
  property.probability('Current', {
    keyed: WRITTEN,
    help: 'an objective function’s value for the system-as-is, by its name (35%)',
  }),
] as const;

const HUB = [
  property.expression('Equation', {
    keyed: WRITTEN,
    functions: EQUATION_FUNCTIONS,
    help: 'a refinement equation, by the variable it defines (Equation[ResponseTime]): an expression over the sub-goals’ variables (MobilizationTime + DistMobilizedAmbulance + AmbDelay)',
  }),
  property.assertion('BooleanEquation', {
    keyed: WRITTEN,
    resolves: [],
    functions: EQUATION_FUNCTIONS,
    help: 'a Boolean variable’s refinement equation, by its name: a condition over the sub-goals’ variables (NoAmbMobilized | WrongMobDest | AmbIntervFailure)',
  }),
  distribution(
    'a variable’s distribution under this refinement, by its name: an equation that is a distribution (FSE’04 §4.1)',
  ),
] as const;

export const kaossim = defineDialect({
  ...kaosprop,
  id: 'kaossim',
  name: 'KAOS quantitative goals',
  properties: {
    ...kaosprop.properties,
    'kaos.BehavioralGoal': [
      ...kaosprop.properties['kaos.BehavioralGoal'],
      ...GOAL,
    ],
    'kaos.Softgoal': [...kaosprop.properties['kaos.Softgoal'], ...GOAL],
    'kaos.RefinementLinkHub': [
      ...kaosprop.properties['kaos.RefinementLinkHub'],
      ...HUB,
    ],
  },
  propertyLineOrder: [...kaosprop.propertyLineOrder, ...GOAL.map((p) => p.key)],
  links: links({
    ...kaosprop.links,
    'kaos.ResponsibilityAssignment': [
      property.text('SysRef', {
        help: 'the system reference: the design option this assignment is, when the goal has several (Heaven and Letier, RE’11)',
      }),
      distribution(
        'a leaf variable’s estimate when this agent is responsible, by its name',
      ),
    ],
  }),
  projectResources: {
    design: {
      label: 'Designs',
      format: 'json',
      role: 'designs',
      path: 'designs.json',
      accept: ['.json'],
      help: 'the alternative systems to simulate: each picks one option (SysRef) per decision point, and may set leaf estimates (FSE’04’s what-if)',
    },
  },
});

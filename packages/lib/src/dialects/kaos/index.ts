/**
 * KAOS goal models as DSM3-goals defines them (J. Pimentel,
 * https://www.cin.ufpe.br/~jhcp/dsm3goals/; istar-ts's `@istar-ts/dsm3-kaos`):
 * a modelling dialect of the `kaos` framework (no engine reads it yet). Its
 * kinds are the KAOS root metamodel's, every node on the paper (KAOS has no
 * actors). Goals carry DSM3's eight properties, a refinement its three (on
 * its hub, where DSM3 saves them) and a conflict its boundary condition, as
 * istar-ts's schemas declare them (goal-controller#171). istar-ts keeps them
 * as text; this dialect gives some a vocabulary, each from one source
 * (goal-controller#181): a value outside it is a Problem, written back as it
 * was. Decisions in packages/dialect/docs/frameworks.md.
 *
 * In the Notation view goals are `G`, agents `A` and domain properties `DP`;
 * there is no bracket notation (a KAOS goal's name keeps its brackets,
 * `Achieve [Manual Backup]`). A refinement, drawn as a hub joining several
 * sub-goals, is an AND: the sub-goals are listed under the goal they refine.
 */
import {
  KAOS_FILL,
  KAOS_REFINEMENT_HUB,
  behavioralGoalProperties,
  conflictProperties,
  refinementProperties,
  type KaosConflictProperties,
  type KaosDeclaredElementKind,
  type KaosGoalProperties,
  type KaosRefinementProperties,
} from '@istar-ts/dsm3-kaos/metamodel';
import {
  defineDialect,
  element,
  links,
  property,
  type ElementDefinition,
  type PropertyDefinition,
} from '@goal-controller/dialect';

/** DSM3's fill for every KAOS node (language_kaos_shapes.js), as istar-ts draws it. */
const FILL = KAOS_FILL;

/**
 * A schema's keys, in its order, each typed here: a key the schema gains and
 * this dialect doesn't type doesn't compile.
 */
const schemaProperties = <S extends object>(
  shape: S,
  typed: { readonly [K in keyof S]: PropertyDefinition },
): PropertyDefinition[] =>
  (Object.keys(shape) as (keyof S & string)[]).map((key) => typed[key]);

/** A free-text property, as DSM3 has every one. */
const text = (key: string, help: string) => property.text(key, { help });

/** what piStar gives every element (DSM3 too): a description */
const DESCRIPTION = property.text('Description', {
  help: 'what it is, in words',
});

/**
 * The vocabularies, one source each (goal-controller#181; the log in
 * frameworks.md, "KAOS stress test"). `''` is "not set".
 */
export const KAOS_VOCABULARIES = {
  /**
   * a goal's type: van Lamsweerde, *Requirements Engineering* (Wiley 2009),
   * ch. 7: the behavioural goals' patterns Achieve, Cease, Maintain, Avoid,
   * and Optimize for soft goals; with DSM3's `softgoal`, which DSM3 presets
   * on a softgoal
   */
  Type: ['Achieve', 'Cease', 'Maintain', 'Avoid', 'Optimize', 'softgoal'],
  /**
   * a goal's category: van Lamsweerde and Letier, TSE 26(10) 2000, the goal
   * categories its obstacle categories come from (Non-satisfaction,
   * Non-information, Inaccuracy, Hazard, Threat)
   */
  Category: ['Satisfaction', 'Information', 'Accuracy', 'Safety', 'Security'],
  /**
   * a goal's priority, an ordinal: no KAOS source fixes its levels (the
   * book's and DSM3's are free), so three, highest first
   */
  Priority: ['high', 'medium', 'low'],
  /**
   * a refinement's tactic: the refinement patterns of Darimont and van
   * Lamsweerde (FSE'96) as Cailliau and van Lamsweerde (RE'12, Table I)
   * propagate probabilities through them
   */
  Tactic: [
    'milestone-driven',
    'case-driven',
    'guard-introduction',
    'divide-and-conquer',
    'uncontrollability',
    'unmonitorability',
  ],
} as const;

/** A property whose values are a vocabulary's (`''`: not set). */
const vocabulary = (
  key: keyof typeof KAOS_VOCABULARIES,
  help: string,
): PropertyDefinition =>
  property.enum(key, ['', ...KAOS_VOCABULARIES[key]], { help });

/**
 * KAOS's formal specifications, in real-time linear temporal logic (the
 * book, ch. 17); a `formula` tagged `ltl`, which nothing checks yet
 */
const formalSpec = (help: string) =>
  property.formula('FormalSpec', 'ltl', { help });

/** DSM3's eight goal properties (language_kaos_metamodel.js), in its order. */
const GOAL = [
  ...schemaProperties<KaosGoalProperties>(behavioralGoalProperties.shape, {
    Type: vocabulary(
      'Type',
      'its type: a behavioural goal’s pattern (Achieve, Cease, Maintain, Avoid), Optimize, or softgoal',
    ),
    Category: vocabulary(
      'Category',
      'its category: what it is about (satisfaction, information, accuracy, safety, security)',
    ),
    Source: text('Source', 'where it comes from: a document, a stakeholder'),
    Priority: vocabulary(
      'Priority',
      'how much it matters, against the others: high, medium, low',
    ),
    Issue: text('Issue', 'what is still open about it'),
    FormalSpec: formalSpec(
      'its formal specification, in real-time linear temporal logic',
    ),
    FitCriterion: text(
      'FitCriterion',
      'how to tell it is satisfied: a measurable criterion',
    ),
    Stability: text('Stability', 'how likely it is to change'),
  }),
  DESCRIPTION,
];

/** a refinement's, on its hub (no line: the inspector edits them) */
const REFINEMENT = schemaProperties<KaosRefinementProperties>(
  refinementProperties.shape,
  {
    SysRef: text(
      'SysRef',
      'the system reference: the design option the refinement belongs to (Heaven and Letier, RE’11)',
    ),
    Status: text('Status', 'where the refinement stands'),
    Tactic: vocabulary(
      'Tactic',
      'the refinement pattern it applies (milestone-driven, case-driven, …); none is milestone-driven',
    ),
  },
);

const CONFLICT = schemaProperties<KaosConflictProperties>(
  conflictProperties.shape,
  {
    BoundaryCondition: text(
      'BoundaryCondition',
      'the condition under which the two can’t both be satisfied',
    ),
  },
);

/** Every KAOS node kind, with its prefix: goals G, agents A, domain properties DP. */
const ELEMENTS = {
  'kaos.BehavioralGoal': element('G', { fill: FILL }),
  'kaos.Softgoal': element('G', { fill: FILL }),
  'kaos.Agent': element('A', { fill: FILL }),
  'kaos.EnvironmentAgent': element('A', { fill: FILL }),
  'kaos.DomainProperty': element('DP', { fill: FILL }),
} as const satisfies Record<KaosDeclaredElementKind, ElementDefinition>;

export const kaos = defineDialect({
  id: 'kaos',
  name: 'KAOS',
  framework: 'kaos',
  elements: ELEMENTS,
  defaultFill: FILL,
  properties: {
    'kaos.BehavioralGoal': GOAL,
    'kaos.Softgoal': GOAL,
    'kaos.Agent': [DESCRIPTION],
    'kaos.EnvironmentAgent': [DESCRIPTION],
    'kaos.DomainProperty': [DESCRIPTION],
    [KAOS_REFINEMENT_HUB]: REFINEMENT,
  },
  propertyLineOrder: GOAL.map((p) => p.key),
  indent: '  ',
  refinements: { 'kaos.RefinementLink': 'and' },
  links: links({ 'kaos.Conflict': CONFLICT }),
  model: { actors: 'many', treesPerActor: 'many' },
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the refinement',
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

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
 * Obstacle analysis (van Lamsweerde and Letier, TSE'00) is istar-ts's
 * `kaosObstacleAnalysis` on the KAOS root, which the workbench reads every
 * KAOS model with: obstacles, their refinements, obstructions and
 * resolutions (goal-controller#181).
 *
 * In the Notation view goals are `G`, agents `A`, domain properties `DP` and
 * obstacles `O`; there is no bracket notation (a KAOS goal's name keeps its
 * brackets, `Achieve [Manual Backup]`). A refinement, drawn as a hub joining
 * several sub-goals (or sub-obstacles), is an AND: they are listed under the
 * goal (or obstacle) they refine. An obstacle obstructs a leaf goal or a
 * domain property, which is not a refinement: an obstacle tree is a tree of
 * its own.
 */
import {
  KAOS_FILL,
  KAOS_REFINEMENT_HUB,
  behavioralGoalProperties,
  conflictProperties,
  domainPropertyProperties,
  obstacleProperties,
  refinementProperties,
  resolutionProperties,
  type KaosConflictProperties,
  type KaosDeclaredElementKind,
  type KaosDomainPropertyProperties,
  type KaosGoalProperties,
  type KaosObstacleDeclaredElementKind,
  type KaosObstacleProperties,
  type KaosRefinementProperties,
  type KaosResolutionProperties,
} from '@istar-ts/dsm3-kaos/metamodel';
import {
  defineDialect,
  element,
  links,
  property,
  type ElementDefinition,
  type EnumOptionInput,
} from '@goal-controller/dialect';

/** DSM3's fill for every KAOS node (language_kaos_shapes.js), as istar-ts draws it. */
const FILL = KAOS_FILL;

/**
 * A schema's keys, each typed here (goal-controller#229): a key the schema
 * gains and this dialect doesn't type doesn't compile. Returns the typed
 * record (not constrained to `PropertyDefinition`, which would widen keys);
 * callers list its values in the schema's order as a `as const` tuple so a
 * mapper's `props` / `raw` keep each key's type.
 */
const schemaProperties = <
  S extends object,
  const T extends { readonly [K in keyof S]: { readonly key: K & string } },
>(
  _shape: S,
  typed: T,
): T => typed;

/** A free-text property, as DSM3 has every one. */
const text = <const K extends string>(key: K, help: string) =>
  property.text(key, { help });

/** what piStar gives every element (DSM3 too): a description */
const DESCRIPTION = property.text('Description', {
  help: 'what it is, in words',
});

/**
 * The vocabularies, one source each (goal-controller#181; the log in
 * frameworks.md, "KAOS stress test"). `''` is "not set". KAOSTools' own
 * names for a value (`milestone`, `mitigation`) are values too, labelled
 * with the one they stand for, so its models lint clean as written.
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
    ['milestone', 'milestone (KAOSTools: milestone-driven)'],
    ['case', 'case (KAOSTools: case-driven)'],
  ],
  /**
   * a domain property's kind: van Lamsweerde 2009, ch. 1 and 8, domain
   * invariants (true whatever the system) and domain hypotheses (assumed);
   * KAOSTools tells them apart by declaration
   */
  Kind: ['invariant', 'hypothesis'],
  /**
   * an obstacle's category: van Lamsweerde and Letier, TSE'00, one per goal
   * category it obstructs (Satisfaction, Information, Accuracy, Safety,
   * Security)
   */
  ObstacleCategory: [
    'Non-satisfaction',
    'Non-information',
    'Inaccuracy',
    'Hazard',
    'Threat',
  ],
  /**
   * a resolution's strategy: van Lamsweerde and Letier, TSE'00, §5's
   * resolution strategies; KAOSTools' `prevention` and `mitigation` are
   * obstacle prevention and obstacle mitigation
   */
  ResolutionType: [
    'goal substitution',
    'agent substitution',
    'obstacle prevention',
    'goal deidealization',
    'domain transformation',
    'obstacle reduction',
    'goal restoration',
    'obstacle mitigation',
    'do-nothing',
    ['prevention', 'prevention (KAOSTools: obstacle prevention)'],
    ['mitigation', 'mitigation (KAOSTools: obstacle mitigation)'],
  ],
} as const satisfies Record<string, readonly EnumOptionInput[]>;

/** A property whose values are a vocabulary's (`''`: not set). */
const vocabulary = <const K extends string>(
  vocabularyKey: keyof typeof KAOS_VOCABULARIES,
  help: string,
  key: K = vocabularyKey as K,
) => property.enum(key, ['', ...KAOS_VOCABULARIES[vocabularyKey]], { help });

/**
 * KAOS's formal specifications, in real-time linear temporal logic (the
 * book, ch. 17); a `formula` tagged `ltl`, which nothing checks yet
 */
const formalSpec = (help: string) =>
  property.formula('FormalSpec', 'ltl', { help });

/** DSM3's eight goal properties (language_kaos_metamodel.js), in its order. */
const GOAL_FIELDS = schemaProperties(
  behavioralGoalProperties.shape as KaosGoalProperties,
  {
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
  },
);
const GOAL = [
  GOAL_FIELDS.Type,
  GOAL_FIELDS.Category,
  GOAL_FIELDS.Source,
  GOAL_FIELDS.Priority,
  GOAL_FIELDS.Issue,
  GOAL_FIELDS.FormalSpec,
  GOAL_FIELDS.FitCriterion,
  GOAL_FIELDS.Stability,
  DESCRIPTION,
] as const;

/** a refinement's, on its hub (no line: the inspector edits them) */
const REFINEMENT_FIELDS = schemaProperties(
  refinementProperties.shape as KaosRefinementProperties,
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
const REFINEMENT = [
  REFINEMENT_FIELDS.SysRef,
  REFINEMENT_FIELDS.Status,
  REFINEMENT_FIELDS.Tactic,
] as const;

const CONFLICT_FIELDS = schemaProperties(
  conflictProperties.shape as KaosConflictProperties,
  {
    BoundaryCondition: text(
      'BoundaryCondition',
      'the condition under which the two can’t both be satisfied',
    ),
  },
);
const CONFLICT = [CONFLICT_FIELDS.BoundaryCondition] as const;

/**
 * a domain property's: its formal specification (the book, ch. 17;
 * goal-controller#338), whether it is an invariant or a hypothesis, then
 * piStar's description
 */
const DOMAIN_PROPERTY_FIELDS = schemaProperties(
  domainPropertyProperties.shape as KaosDomainPropertyProperties,
  {
    FormalSpec: formalSpec(
      'its formal specification, in real-time linear temporal logic',
    ),
    Kind: vocabulary(
      'Kind',
      'whether it always holds (an invariant) or is assumed (a hypothesis)',
    ),
  },
);
const DOMAIN_PROPERTY = [
  DOMAIN_PROPERTY_FIELDS.FormalSpec,
  DOMAIN_PROPERTY_FIELDS.Kind,
  DESCRIPTION,
] as const;

/** an obstacle's (TSE'00), in istar-ts's order */
const OBSTACLE_FIELDS = schemaProperties(
  obstacleProperties.shape as KaosObstacleProperties,
  {
    Description: DESCRIPTION,
    FormalSpec: formalSpec(
      'its formal definition, in real-time linear temporal logic',
    ),
    Category: vocabulary(
      'ObstacleCategory',
      'its category: what kind of goal it obstructs (non-satisfaction, non-information, inaccuracy, hazard, threat)',
      'Category',
    ),
  },
);
const OBSTACLE = [
  OBSTACLE_FIELDS.Description,
  OBSTACLE_FIELDS.FormalSpec,
  OBSTACLE_FIELDS.Category,
] as const;

/** a resolution's: its strategy, and the goal a mitigation restores */
const RESOLUTION_FIELDS = schemaProperties(
  resolutionProperties.shape as KaosResolutionProperties,
  {
    ResolutionType: vocabulary(
      'ResolutionType',
      'how the goal resolves the obstacle (TSE’00’s strategies)',
    ),
    Anchor: property.reference(
      'Anchor',
      ['kaos.BehavioralGoal', 'kaos.Softgoal'],
      {
        help: 'the goal the resolution restores or weakens, by its id (a mitigation’s anchor)',
      },
    ),
  },
);
const RESOLUTION = [
  RESOLUTION_FIELDS.ResolutionType,
  RESOLUTION_FIELDS.Anchor,
] as const;

/** Every KAOS node kind, with its prefix: goals G, agents A, domain properties DP, obstacles O. */
const ELEMENTS = {
  'kaos.BehavioralGoal': element('G', { fill: FILL }),
  'kaos.Softgoal': element('G', { fill: FILL }),
  'kaos.Agent': element('A', { fill: FILL }),
  'kaos.EnvironmentAgent': element('A', { fill: FILL }),
  'kaos.DomainProperty': element('DP', { fill: FILL }),
  'kaosObstacles.Obstacle': element('O', { fill: FILL }),
} as const satisfies Record<
  KaosDeclaredElementKind | KaosObstacleDeclaredElementKind,
  ElementDefinition
>;

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
    'kaos.DomainProperty': DOMAIN_PROPERTY,
    'kaosObstacles.Obstacle': OBSTACLE,
    [KAOS_REFINEMENT_HUB]: REFINEMENT,
  },
  // a goal's (FormalSpec already among them), then a domain property's Kind
  // (an obstacle's keys are a goal's)
  propertyLineOrder: [...GOAL.map((p) => p.key), 'Kind'],
  indent: '  ',
  refinements: {
    'kaos.RefinementLink': 'and',
    'kaosObstacles.ObstacleRefinementLink': 'and',
  },
  leafTargets: ['kaosObstacles.ObstructionLink'],
  links: links({
    'kaos.Conflict': CONFLICT,
    'kaosObstacles.ResolutionLink': RESOLUTION,
  }),
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

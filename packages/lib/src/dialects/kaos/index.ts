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
 * The operation and object models (Letier and van Lamsweerde, FSE'02;
 * goal-controller#194) are this dialect's own `extension`, on the KAOS root
 * (#181 PR E; istar-ts has none of them): operations, entities,
 * associations, events, and KAOSTools' predicates and types, with the
 * operationalisation, performance, monitoring, control, cause, input,
 * output and association links. Files write them as `kaos.*` (`pistarType`),
 * as they write obstacles, and a model with any declares them in its
 * `"metamodel"` block.
 *
 * In the Notation view goals are `G`, agents `A`, domain properties `DP` and
 * obstacles `O`, operations `OP`, entities `EN`, associations `AS`, events
 * `EV`, predicates `PR` and types `TY`; there is no bracket notation (a KAOS goal's name keeps its
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
  defineExtension,
  element,
  extensionKind,
  extensionLink,
  links,
  property,
  type ElementDefinition,
  type EnumOptionInput,
} from '@goal-controller/dialect';

/** DSM3's fill for every KAOS node (language_kaos_shapes.js), as istar-ts draws it. */
const FILL = KAOS_FILL;

const OPERATION = 'kaosOperations.Operation';
const ENTITY = 'kaosOperations.Entity';
const ASSOCIATION = 'kaosOperations.Association';
const EVENT = 'kaosOperations.Event';
const PREDICATE = 'kaosOperations.Predicate';

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
   * a resolution's strategy: van Lamsweerde and Letier, TSE'00, §6's
   * resolution strategies, with §6.3.2's two forms of mitigation, weak and
   * strong (goal-controller#191); KAOSTools' `prevention` and `mitigation`
   * are obstacle prevention and obstacle mitigation
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
    'weak mitigation',
    'strong mitigation',
    'do-nothing',
    ['prevention', 'prevention (KAOSTools: obstacle prevention)'],
    ['mitigation', 'mitigation (KAOSTools: obstacle mitigation)'],
  ],
  /**
   * an entity's type: KAOSTools' `type` on an entity
   * (`EntityTypeAttributeParser.cs`, goal-controller#194): where it lives,
   * in the software, its environment, or both
   */
  EntityType: ['software', 'environment', 'shared'],
} as const satisfies Record<string, readonly EnumOptionInput[]>;

/** A property whose values are a vocabulary's (`''`: not set). */
const vocabulary = <const K extends string>(
  vocabularyKey: keyof typeof KAOS_VOCABULARIES,
  help: string,
  key: K = vocabularyKey as K,
) => property.enum(key, ['', ...KAOS_VOCABULARIES[vocabularyKey]], { help });

/**
 * What an `ltl` formula is type-checked against (goal-controller#385): a
 * predicate's arity from its `Arguments` pairList, an entity's attributes
 * from its `Attributes` pairList, a relation from an association's id.
 * None of the three kinds has an element in a given model: the open world
 * for that one (frameworks.md, "KAOS stress test", step 7).
 */
export const OBJECT_MODEL_SYMBOLS = {
  predicates: { kind: PREDICATE, arguments: 'Arguments' },
  entities: { kind: ENTITY, attributes: 'Attributes' },
  relations: { kind: ASSOCIATION },
} as const;

/**
 * KAOS's formal specifications, in real-time linear temporal logic (the
 * book, ch. 17); a `formula` tagged `ltl`, type-checked against the
 * operation and object models' declared predicates, entities and
 * associations (goal-controller#385)
 */
const formalSpec = (help: string) =>
  property.formula('FormalSpec', 'ltl', {
    help,
    symbols: OBJECT_MODEL_SYMBOLS,
  });

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
      { kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'] },
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

/**
 * Where a KAOS node lies: on the paper, as every KAOS node does (KAOS has no
 * actors), not piStar-ext's default for an extension's node.
 */
const ON_PAPER = {
  canBeInnerElement: false,
  canBeDependum: false,
  canBeOnPaper: true,
} as const;

/** DSM3's node size (language_kaos_shapes.js), every KAOS node's. */
const SIZE = { width: 135, height: 36 } as const;

/** A node of the operation or object model, saved as `kaos.<Name>`. */
const node = <const N extends string>(name: N, label: string = name) =>
  extensionKind(`kaosOperations.${name}`, {
    label,
    category: 'node',
    pistarType: `kaos.${name}`,
    size: SIZE,
    info: ON_PAPER,
  });

const AGENTS = ['kaos.Agent', 'kaos.EnvironmentAgent'] as const;
/**
 * KAOS's objects (FSE'02 §2.1.2; the Respect-IT tutorial, §3.4): entities,
 * associations, events and agents, which an operation reads and writes and
 * an agent monitors and controls
 */
const OBJECTS = [ENTITY, ASSOCIATION, EVENT, ...AGENTS] as const;

/** A link of the operation or object model, saved as `kaos.<Name>`. */
const link = <const N extends string>(
  name: N,
  label: string,
  sources: readonly string[],
  targets: readonly string[],
  unique: 'kind' | false = 'kind',
  allowSelf = false,
) =>
  extensionLink(`kaosOperations.${name}`, {
    label,
    pistarType: `kaos.${name}`,
    rules: {
      sources,
      targets,
      sameActor: false,
      unique,
      ...(allowSelf && { allowSelf }),
    },
  });

/**
 * KAOS's operation and object models (goal-controller#194, D1), on the KAOS
 * root: operations (FSE'02 §2.1.4), entities, associations and events (the
 * object model, §2.1.2; the Respect-IT tutorial, §3.4), and KAOSTools'
 * predicates and types (`declare predicate`, `declare type`). The links:
 * an operation operationalises a requirement (with its required
 * conditions), an agent performs it, monitors and controls objects'
 * attributes, an event causes it, it reads its input objects and writes its
 * output ones, and an association links objects. A monitoring or a control
 * link names one attribute, so an agent may have several onto one object.
 */
export const kaosOperations = defineExtension(
  {
    name: 'kaosOperations',
    label: 'KAOS operations and objects',
    elements: [
      node('Operation'),
      node('Entity'),
      node('Association'),
      node('Event'),
      node('Predicate'),
      node('Type'),
    ],
    links: [
      link(
        'OperationalisationLink',
        'Operationalisation',
        [OPERATION],
        ['kaos.BehavioralGoal'],
      ),
      link('PerformanceLink', 'Performance', AGENTS, [OPERATION]),
      // an agent monitors and controls its own attributes too (FSE'02's
      // PumpController.PumpSwitch)
      link(
        'MonitoringLink',
        'Monitoring',
        AGENTS,
        [...OBJECTS, PREDICATE],
        false,
        true,
      ),
      link(
        'ControlLink',
        'Control',
        AGENTS,
        [...OBJECTS, PREDICATE],
        false,
        true,
      ),
      link('CauseLink', 'Cause', [EVENT], [OPERATION]),
      link('InputLink', 'Input', OBJECTS, [OPERATION]),
      link('OutputLink', 'Output', [OPERATION], OBJECTS),
      link('AssociationLink', 'Association', [ASSOCIATION], OBJECTS, false),
    ],
    groupers: {},
    stereotypes: [],
    taggedValues: [],
    defaultTags: [],
  },
  undefined,
  'kaos',
);

/**
 * The operation and object models' node kinds (goal-controller#194), which
 * an engine that doesn't read them ignores (they stay the model's elements).
 */
export const KAOS_OPERATION_KINDS = kaosOperations.elements.map(
  (kind) => kind.kind,
);

/** The operation and object models' link kinds with properties, which such an engine's links map as written. */
export const KAOS_OPERATION_LINKS = [
  'kaosOperations.OperationalisationLink',
  'kaosOperations.MonitoringLink',
  'kaosOperations.ControlLink',
  'kaosOperations.CauseLink',
  'kaosOperations.AssociationLink',
] as const;

/**
 * Every KAOS node kind, with its prefix: goals G, agents A, domain
 * properties DP, obstacles O; operations OP, entities EN, associations AS,
 * events EV, predicates PR and types TY.
 */
const ELEMENTS = {
  'kaos.BehavioralGoal': element('G', { fill: FILL }),
  'kaos.Softgoal': element('G', { fill: FILL }),
  'kaos.Agent': element('A', { fill: FILL }),
  'kaos.EnvironmentAgent': element('A', { fill: FILL }),
  'kaos.DomainProperty': element('DP', { fill: FILL }),
  'kaosObstacles.Obstacle': element('O', { fill: FILL }),
  [OPERATION]: element('OP', { fill: FILL }),
  [ENTITY]: element('EN', { fill: FILL }),
  [ASSOCIATION]: element('AS', { fill: FILL }),
  [EVENT]: element('EV', { fill: FILL }),
  [PREDICATE]: element('PR', { fill: FILL }),
  'kaosOperations.Type': element('TY', { fill: FILL }),
} as const satisfies Record<
  | KaosDeclaredElementKind
  | KaosObstacleDeclaredElementKind
  | (typeof kaosOperations.elements)[number]['kind'],
  ElementDefinition
>;

/**
 * An object's attributes (FSE'02's `Has PumpSwitch: {On, Off}`; KAOSTools'
 * `attribute name : type`), each its name and type: `bool`, a number
 * (`int`, `number`), its values (`On|Off`), or a type's name. They are the
 * members a monitoring or a control names (`sump.highWater`, D2).
 */
const ATTRIBUTES = property.pairList('Attributes', 'text', {
  help: 'its attributes, each name:type (HighWater:bool, PumpSwitch:On|Off)',
});

/**
 * an ltl formula of the operation model (FSE'02 §2.1.4), type-checked
 * against the operation and object models (goal-controller#385)
 */
const condition = <const K extends string>(key: K, help: string) =>
  property.formula(key, 'ltl', { help, symbols: OBJECT_MODEL_SYMBOLS });

const OPERATION_PROPERTIES = [
  condition(
    'DomPre',
    'its domain precondition: what holds in any state it is applied in',
  ),
  condition(
    'DomPost',
    'its domain postcondition: what holds in any state it leads to',
  ),
  DESCRIPTION,
] as const;

const ENTITY_PROPERTIES = [
  vocabulary(
    'EntityType',
    'where it lives: in the software, its environment, or both (shared)',
    'EntityType',
  ),
  ATTRIBUTES,
  DESCRIPTION,
] as const;

const EVENT_PROPERTIES = [
  text('Frequency', 'how often it occurs (Objectiver’s Frequency)'),
  ATTRIBUTES,
  DESCRIPTION,
] as const;

const PREDICATE_PROPERTIES = [
  property.pairList('Arguments', 'text', {
    help: 'its arguments, each name:type (a:ambulance)',
  }),
  formalSpec('its formal definition, in real-time linear temporal logic'),
  property.bool('Default', {
    help: 'its value when nothing has set it (KAOSTools’ default)',
  }),
  DESCRIPTION,
] as const;

/**
 * an agent's, besides its description: its load (Objectiver's) and its
 * attributes (FSE'02's agents have some: PumpController's PumpSwitch)
 */
const AGENT_PROPERTIES = [
  DESCRIPTION,
  text(
    'Load',
    'how much of its capacity its operations take (Objectiver’s Load)',
  ),
  ATTRIBUTES,
] as const;

/** a monitoring's or a control's attribute: an object's, by `object.attribute` (D2) */
const attribute = <const K extends string>(key: K, help: string) =>
  property.reference(
    key,
    { kinds: [...OBJECTS, PREDICATE] },
    { members: { from: 'Attributes' }, help },
  );

export const kaos = defineDialect({
  id: 'kaos',
  name: 'KAOS',
  framework: 'kaos',
  extension: kaosOperations,
  elements: ELEMENTS,
  defaultFill: FILL,
  properties: {
    'kaos.BehavioralGoal': GOAL,
    'kaos.Softgoal': GOAL,
    'kaos.Agent': AGENT_PROPERTIES,
    'kaos.EnvironmentAgent': AGENT_PROPERTIES,
    'kaos.DomainProperty': DOMAIN_PROPERTY,
    'kaosObstacles.Obstacle': OBSTACLE,
    [KAOS_REFINEMENT_HUB]: REFINEMENT,
    [OPERATION]: OPERATION_PROPERTIES,
    [ENTITY]: ENTITY_PROPERTIES,
    [ASSOCIATION]: [ATTRIBUTES, DESCRIPTION],
    [EVENT]: EVENT_PROPERTIES,
    [PREDICATE]: PREDICATE_PROPERTIES,
    'kaosOperations.Type': [DESCRIPTION],
  },
  // a goal's (FormalSpec already among them), then a domain property's Kind
  // (an obstacle's keys are a goal's), then the operation and object
  // models' (goal-controller#194)
  propertyLineOrder: [
    ...GOAL.map((p) => p.key),
    'Kind',
    'DomPre',
    'DomPost',
    'EntityType',
    'Frequency',
    'Arguments',
    'Default',
    'Load',
    'Attributes',
  ],
  indent: '  ',
  refinements: {
    'kaos.RefinementLink': 'and',
    'kaosObstacles.ObstacleRefinementLink': 'and',
  },
  leafTargets: ['kaosObstacles.ObstructionLink'],
  // the Respect-IT tutorial's triangle (§3.5, Fig. 30; goal-controller#210):
  // the agent performing an operation that operationalises a requirement is
  // responsible for it, FSE'02's inter-model consistency
  closures: [
    {
      path: [
        'kaosOperations.PerformanceLink',
        'kaosOperations.OperationalisationLink',
      ],
      closedBy: 'kaos.ResponsibilityAssignment',
      severity: 'error',
      message:
        '{start} performs {via}, which operationalises {end}, but is not responsible for it: assign {end} to {start}',
    },
  ],
  links: links({
    'kaos.Conflict': CONFLICT,
    'kaosObstacles.ResolutionLink': RESOLUTION,
    // FSE'02 §2.1.4: an operation's required conditions for a requirement
    'kaosOperations.OperationalisationLink': [
      condition(
        'ReqPre',
        'its required precondition for the requirement: when it may be applied',
      ),
      condition(
        'ReqTrig',
        'its required trigger condition for the requirement: when it must be applied (its domain precondition holding)',
      ),
      condition(
        'ReqPost',
        'its required postcondition for the requirement: what must hold after it',
      ),
    ],
    'kaosOperations.MonitoringLink': [
      attribute('Monitors', 'the attribute it monitors, object.attribute'),
    ],
    'kaosOperations.ControlLink': [
      attribute('Controls', 'the attribute it controls, object.attribute'),
    ],
    'kaosOperations.CauseLink': [
      text(
        'Delay',
        'how long after the event the operation starts (Objectiver’s Delay)',
      ),
    ],
    'kaosOperations.AssociationLink': [
      text(
        'Multiplicity',
        'how many of the object an instance links: 1, *, 0..1 (KAOSTools’ link multiplicity)',
      ),
      text('Role', 'the object’s role in the association'),
    ],
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

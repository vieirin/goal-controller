/**
 * What `.kaos` and a KAOS piStar model call the same things
 * (goal-controller#181): the declarations and the kinds they are, and
 * KAOSTools' refinement and resolution patterns as the `kaos` dialect's
 * vocabularies name them (packages/dialect/docs/frameworks.md, "KAOS stress
 * test", PR F). Shared by the reader and the writer, so each reads what the
 * other writes.
 */

/** A declaration the reader places in the model, and the kind (as files write it) it is. */
export const KAOS_DECLARATIONS = {
  goal: 'kaos.BehavioralGoal',
  softgoal: 'kaos.Softgoal',
  obstacle: 'kaos.Obstacle',
  domainproperty: 'kaos.DomainProperty',
  domainhypothesis: 'kaos.DomainProperty',
  agent: 'kaos.Agent',
} as const;

export type KaosDeclarationKind = keyof typeof KAOS_DECLARATIONS;

export const isKaosDeclaration = (kind: string): kind is KaosDeclarationKind =>
  Object.hasOwn(KAOS_DECLARATIONS, kind);

/** The kinds as piStar files write them (`kaos.Obstacle`, istar-ts's `kaosObstacles.Obstacle`). */
export const KAOS_TYPES = {
  goal: 'kaos.BehavioralGoal',
  softgoal: 'kaos.Softgoal',
  obstacle: 'kaos.Obstacle',
  domainProperty: 'kaos.DomainProperty',
  agent: 'kaos.Agent',
  environmentAgent: 'kaos.EnvironmentAgent',
  refinementHub: 'kaos.RefinementLinkHub',
  refinementLeg: 'kaos.RefinementLinkStart',
  refinementEnd: 'kaos.RefinementLinkEnd',
  obstacleRefinementHub: 'kaos.ObstacleRefinementLinkHub',
  obstacleRefinementLeg: 'kaos.ObstacleRefinementLinkStart',
  obstacleRefinementEnd: 'kaos.ObstacleRefinementLinkEnd',
  obstruction: 'kaos.ObstructionLink',
  resolution: 'kaos.ResolutionLink',
  assignment: 'kaos.ResponsibilityAssignment',
} as const;

/**
 * KAOSTools' refinement patterns (`refinedby [milestone]`,
 * `RefinedByAttributeParser.cs`) and the `Tactic` each is (FSE'96's names,
 * as the `kaos` dialect's vocabulary has them).
 */
export const KAOSTOOLS_TACTICS: Readonly<Record<string, string>> = {
  milestone: 'milestone-driven',
  case: 'case-driven',
  introduce_guard: 'guard-introduction',
  divide_and_conquer: 'divide-and-conquer',
  uncontrollability: 'uncontrollability',
  unmonitorability: 'unmonitorability',
};

/**
 * KAOSTools' resolution patterns (`resolvedby [mitigation:g]`,
 * `ResolvedByAttributeBuilder.cs`, `KAOSFileExporter.cs`) and the
 * `ResolutionType` each is (TSE'00 §6's strategies; its §6.3.2's weak and
 * strong mitigation since goal-controller#191).
 */
export const KAOSTOOLS_RESOLUTIONS: Readonly<Record<string, string>> = {
  prevention: 'obstacle prevention',
  mitigation: 'obstacle mitigation',
  substitution: 'goal substitution',
  restoration: 'goal restoration',
  weakening: 'goal deidealization',
  obstacle_reduction: 'obstacle reduction',
  weak_mitigation: 'weak mitigation',
  strong_mitigation: 'strong mitigation',
};

/** A table's inverse: a value's KAOSTools name. */
const inverse = (table: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(table).map(([k, v]) => [v, k]));

export const TACTIC_PATTERNS: Readonly<Record<string, string>> =
  inverse(KAOSTOOLS_TACTICS);
export const RESOLUTION_PATTERNS: Readonly<Record<string, string>> = inverse(
  KAOSTOOLS_RESOLUTIONS,
);

/**
 * The `kaos` dialect's text keys `.kaos` has no attribute for, by kind:
 * written as KAOSTools' custom attributes (`$Priority "high"`), and read
 * back from them. Every other custom attribute is kept as written.
 */
export const CUSTOM_KEYS: Readonly<Record<string, readonly string[]>> = {
  'kaos.BehavioralGoal': [
    'Type',
    'Category',
    'Source',
    'Priority',
    'Issue',
    'FitCriterion',
    'Stability',
    'Evidence',
  ],
  'kaos.Softgoal': [
    'Type',
    'Category',
    'Source',
    'Priority',
    'Issue',
    'FitCriterion',
    'Stability',
    'Evidence',
  ],
  // kaosexpert's Evidence (goal-controller#199): the evidence items (a
  // comma-separated list of ids) a leaf goal's ESR or a leaf obstacle's
  // Probability is based on, written as a custom attribute like any text key
  'kaos.Obstacle': ['Category', 'Evidence'],
};

/** A KAOSTools identifier: a letter, then letters, digits, `_` and `-`. */
export const isKaosIdentifier = (text: string) =>
  /^[A-Za-z][A-Za-z0-9_-]*$/.test(text) && text !== 'end';

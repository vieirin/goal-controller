/**
 * Tropos4AS's words (goal-controller#134, #136): the kinds and links it adds
 * to iStar 2.0 (#134 D2, as iStar 2011's Fig. 1 draws them), its goal types
 * and the goal states and transition rules of AAMAS 2009's abstract
 * architecture (§4.1, §4.2), named as the paper names them.
 */

/** The kinds it adds (the `tropos4as` extension). */
export const TROPOS4AS_KINDS = {
  /** the environment: what its conditions read (`room`, with `clean`) */
  artifact: 'tropos4as.Artifact',
  failure: 'tropos4as.Failure',
  /** a goal adopted when its condition holds; its recovery tasks are its means */
  error: 'tropos4as.Error',
  symptom: 'tropos4as.Symptom',
} as const;

/** The links it adds. */
export const TROPOS4AS_LINKS = {
  /** goal → goal: the target leaves Γ while the source is active */
  inhibits: 'tropos4as.InhibitsLink',
  /** goal → goal: the source comes before the target in Γ */
  sequence: 'tropos4as.SequenceLink',
  /** goal → failure: the failure its failing is */
  failure: 'tropos4as.FailureLink',
  /** error → failure: what causes it (Fig. 1 draws the arrow into the failure) */
  error: 'tropos4as.ErrorLink',
  /** symptom → failure: how it shows (no lifecycle effect) */
  symptom: 'tropos4as.SymptomLink',
  /**
   * artifact → goal or error: a condition of the target reads it (iStar
   * 2011's Fig. 1 draws a condition note dashed to both; here the condition
   * is the target's property, #134 D3)
   */
  reads: 'tropos4as.ReadsLink',
} as const;

/** AAMAS 2009 §3: the three goal types (achieve, the default). */
export const GOAL_TYPES = ['achieve', 'maintain', 'perform'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/**
 * §4.3.2: what an achieve-goal does when its success condition is still
 * false after its subgoals: a) restart (⟨¬s, Reactivate⟩, the default and
 * §5's) or b) fail completely (⟨¬s, DropFailure⟩).
 */
export const ON_FAILURE = ['restart', 'drop'] as const;
export type OnFailure = (typeof ON_FAILURE)[number];

/**
 * The types an artifact's attribute may have (`clean:bool`), as member
 * references read them (#135): a bool, a number, or its options (`mode:wet|dry`).
 */
export const ATTRIBUTE_TYPES = ['bool', 'int', 'number'] as const;

/** Whether `type` is an attribute's type: one of ATTRIBUTE_TYPES, or options `a|b`. */
export const isAttributeType = (type: string): boolean =>
  (ATTRIBUTE_TYPES as readonly string[]).includes(type) ||
  /^\w+(\|\w+)+$/.test(type);

/** The goal properties that hold a condition, in the order they are listed. */
export const CONDITION_KEYS = [
  'creation',
  'achievement',
  'failure',
  'maintain',
  'target',
  'drop',
  'precondition',
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

/** §4.1: S = {Suspended, AD, AU, AS, AF}. */
export const GOAL_STATES = ['Suspended', 'AD', 'AU', 'AS', 'AF'] as const;
export type GoalState = (typeof GOAL_STATES)[number];

/** How a state is shown (§4.1's names). */
export const STATE_LABELS: Readonly<Record<GoalState, string>> = {
  Suspended: 'suspended',
  AD: 'active-deliberate',
  AU: 'active-undefined',
  AS: 'active-success',
  AF: 'active-failure',
};

/** §4.1: the transition actions of a condition–action pair. */
export const ACTIONS = [
  'Activate',
  'Suspend',
  'Fail',
  'Succeed',
  'Retry',
  'Reactivate',
  'DropFailure',
  'DropSuccess',
] as const;
export type Action = (typeof ACTIONS)[number];

/** §4.2: every transition rule, by its name in the paper; `adopt` is a goal's entry into G. */
export const RULES = [
  'adopt',
  'activateC',
  'activateE',
  'deliberateE',
  'deliberateC',
  'AND:subg-achieve',
  'AND:subg-fail',
  'OR:subg-achieve',
  'OR:subg-succeed',
  'AND:subg-succeed',
  'OR:subg-fail',
  'cond-succeedC',
  'cond-failC',
  'cond-succeedE',
  'cond-failE',
  'drop-successC',
  'drop-successE',
  'drop-failureC',
  'drop-failureE',
  'reactivateC',
  'reactivateE',
  'suspendC',
  'suspendE',
  'retryC',
] as const;
export type RuleName = (typeof RULES)[number];

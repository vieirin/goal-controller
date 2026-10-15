/**
 * Contextual goal models' words (Ali, Dalpiaz, Giorgini; REJ 2010, IST
 * 2013; goal-controller#151, #153): the kinds and links the `cgm`
 * extension adds to iStar 2.0, and the property keys its analyses read.
 */

/** The kinds it adds: context analysis (REJ 2010 §3.4, Defs. 3–7). */
export const CGM_KINDS = {
  /** a context (`C4`): a formula over statements and facts, at variation points */
  context: 'cgm.Context',
  /** a world predicate the actor can't verify, supported by a formula (Defs. 4–5) */
  statement: 'cgm.Statement',
  /** a world predicate the actor can verify (Def. 3) */
  fact: 'cgm.Fact',
} as const;

/** The links it adds: Fig. 13's cost relations (#151 D11), task → task. */
export const CGM_LINKS = {
  /** `Include(T2, T1)`: the source's work includes the target's, its whole cost */
  includes: 'cgm.IncludesLink',
  /** `Intersect(T3, T4, 40)`: the two share work of `amount` */
  intersects: 'cgm.IntersectsLink',
} as const;

/** The property keys the analyses read. */
export const CGM_KEYS = {
  /** a link's context (a variation point), or a contribution's (#151 D10) */
  context: 'context',
  /** a contribution's: when its opposite label applies (#151 D10) */
  opposite: 'opposite',
  /** a root goal's activation context */
  activation: 'activation',
  /** a task's development cost (§5.3) */
  cost: 'cost',
  /** an intersection's shared cost */
  amount: 'amount',
  /** a context's formula over statements and facts */
  formula: 'formula',
  /** a statement's supporting formula */
  supportedBy: 'supportedBy',
} as const;

/** iStar's contribution labels with their opposites (#151 D10). */
export const OPPOSITE_LABEL: Readonly<Record<string, string>> = {
  make: 'break',
  help: 'hurt',
  break: 'make',
  hurt: 'help',
};

/** Whether a contribution label is positive (REJ 2010 §4's binary contributions). */
export const isPositiveLabel = (label: string | undefined): boolean =>
  label === 'make' || label === 'help';

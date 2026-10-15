/**
 * AAMAS 2009 §4.1–4.2: the abstract architecture for non-leaf goals in goal
 * models. A goal at run time is g(C, E, s, Γ): its condition–action sets
 * (./instantiations), its state s ∈ {Suspended, AD, AU, AS, AF} and Γ, the
 * subgoals its deliberation returned and it hasn't pursued yet. The
 * transition rules are data here, each with its premises; `nextTransition`
 * picks the one that fires.
 *
 * How the rules are read (goal-controller#134 D5):
 * - "E" and "C" in a rule's name: Γ is empty or not, and the set its
 *   conditions are evaluated in (§4.1). The premises `¬∃⟨c, Fail⟩ ∈ C` of
 *   [AND:subg-succeed] and [cond-succeedE], and `¬∃⟨c, Succeed⟩ ∈ C` of
 *   [OR:subg-fail], are printed with C but apply when Γ = ∅: they are read
 *   in E. §5's trace is the same either way.
 * - Precedence: the premises first (failure over success; a true Fail or
 *   Succeed before adopting a subgoal); then a decomposition's rule before a
 *   condition's; then, among condition rules, the order the instantiation
 *   lists the pairs that enable them (§4.2.5). A rule that would change
 *   nothing ([cond-succeedC] from AS) doesn't fire.
 */
import type { Action, GoalState, RuleName } from '../vocabulary';
import type { Beliefs } from './conditions';
import type { Instantiation, Pair } from './instantiations';

/** A goal at run time: g(C, E, s, Γ), with its decomposition. */
export type GoalInstance = {
  state: GoalState;
  /** Γ: the subgoals left, by id, in the order they are pursued */
  gamma: readonly string[];
  relation: 'AND' | 'OR';
  instantiation: Instantiation;
};

/** What a rule does: the goal's next state and Γ, or its drop (§4.2.4). */
export type Transition = {
  rule: RuleName;
  state: GoalState;
  gamma: readonly string[];
  /** dropped from G, with success(g) or failed(g) added to B */
  dropped?: 'success' | 'failed';
};

/** The set a goal's conditions are evaluated in: E when Γ is empty, C when not (§4.1). */
export const setOf = (goal: GoalInstance): readonly Pair[] =>
  goal.gamma.length ? goal.instantiation.C : goal.instantiation.E;

/** The position of the first pair ⟨c, action⟩ of `set` with B |= c, or -1. */
export const trueAt = (
  set: readonly Pair[],
  action: Action,
  beliefs: Beliefs,
): number =>
  set.findIndex(
    (pair) => pair.action === action && pair.condition.holds(beliefs),
  );

const holds = (set: readonly Pair[], action: Action, beliefs: Beliefs) =>
  trueAt(set, action, beliefs) >= 0;

/**
 * A rule its condition–action pair enables: in a state, with Γ empty (E)
 * or not (C), when ⟨c, action⟩ is in the set and B |= c.
 */
export type ConditionRule = {
  name: RuleName;
  from: readonly GoalState[];
  gamma: 'empty' | 'nonEmpty';
  action: Action;
  /** a premise beyond its pair */
  premise?: (goal: GoalInstance, beliefs: Beliefs) => boolean;
  to: (goal: GoalInstance) => Omit<Transition, 'rule'>;
};

const noFail = (goal: GoalInstance, beliefs: Beliefs) =>
  !holds(setOf(goal), 'Fail', beliefs);

/** §4.2.1, §4.2.3–4.2.5: the rules a condition enables, in the paper's order. */
export const CONDITION_RULES: readonly ConditionRule[] = [
  // 4.2.1 activation: Suspended → AD
  {
    name: 'activateC',
    from: ['Suspended'],
    gamma: 'nonEmpty',
    action: 'Activate',
    to: ({ gamma }) => ({ state: 'AD', gamma }),
  },
  {
    name: 'activateE',
    from: ['Suspended'],
    gamma: 'empty',
    action: 'Activate',
    to: () => ({ state: 'AD', gamma: [] }),
  },
  // 4.2.3 success and failure by conditions: "in the case that both
  // conditions are true, failure conditions have precedence"; X ∈ {AU, AS}
  {
    name: 'cond-succeedC',
    from: ['AU', 'AS'],
    gamma: 'nonEmpty',
    action: 'Succeed',
    premise: noFail,
    to: ({ gamma }) => ({ state: 'AS', gamma }),
  },
  {
    name: 'cond-failC',
    from: ['AU', 'AS'],
    gamma: 'nonEmpty',
    action: 'Fail',
    to: ({ gamma }) => ({ state: 'AF', gamma }),
  },
  {
    name: 'cond-succeedE',
    from: ['AU'],
    gamma: 'empty',
    action: 'Succeed',
    premise: noFail,
    to: () => ({ state: 'AS', gamma: [] }),
  },
  {
    name: 'cond-failE',
    from: ['AU'],
    gamma: 'empty',
    action: 'Fail',
    to: () => ({ state: 'AF', gamma: [] }),
  },
  // 4.2.4 dropping: from AS with success(g), from AF with failed(g)
  {
    name: 'drop-successC',
    from: ['AS'],
    gamma: 'nonEmpty',
    action: 'DropSuccess',
    to: ({ gamma }) => ({ state: 'AS', gamma, dropped: 'success' }),
  },
  {
    name: 'drop-successE',
    from: ['AS'],
    gamma: 'empty',
    action: 'DropSuccess',
    to: () => ({ state: 'AS', gamma: [], dropped: 'success' }),
  },
  {
    name: 'drop-failureC',
    from: ['AF'],
    gamma: 'nonEmpty',
    action: 'DropFailure',
    to: ({ gamma }) => ({ state: 'AF', gamma, dropped: 'failed' }),
  },
  {
    name: 'drop-failureE',
    from: ['AF'],
    gamma: 'empty',
    action: 'DropFailure',
    to: () => ({ state: 'AF', gamma: [], dropped: 'failed' }),
  },
  // 4.2.5 reactivation (AF → AD, "remaining subgoals in Γ are deleted"),
  // suspension (AS → Suspended, Γ emptied) and retry (AS → AU, Γ kept)
  {
    name: 'reactivateC',
    from: ['AF'],
    gamma: 'nonEmpty',
    action: 'Reactivate',
    to: () => ({ state: 'AD', gamma: [] }),
  },
  {
    name: 'reactivateE',
    from: ['AF'],
    gamma: 'empty',
    action: 'Reactivate',
    to: () => ({ state: 'AD', gamma: [] }),
  },
  {
    name: 'suspendC',
    from: ['AS'],
    gamma: 'nonEmpty',
    action: 'Suspend',
    to: () => ({ state: 'Suspended', gamma: [] }),
  },
  {
    name: 'suspendE',
    from: ['AS'],
    gamma: 'empty',
    action: 'Suspend',
    to: () => ({ state: 'Suspended', gamma: [] }),
  },
  {
    name: 'retryC',
    from: ['AS'],
    gamma: 'nonEmpty',
    action: 'Retry',
    to: ({ gamma }) => ({ state: 'AU', gamma }),
  },
];

/**
 * §4.2.2: AD → AU. [deliberateE] reveals the subgoals ("the function
 * deliberate returns a list Γ of subgoals to satisfy"); [deliberateC]
 * keeps a Γ it already has ("no deliberation takes place in the case that
 * Γ ≠ ∅").
 */
export const deliberation = (
  goal: GoalInstance,
  deliberate: () => readonly string[],
): Transition | null =>
  goal.state !== 'AD'
    ? null
    : goal.gamma.length
      ? { rule: 'deliberateC', state: 'AU', gamma: goal.gamma }
      : { rule: 'deliberateE', state: 'AU', gamma: deliberate() };

/**
 * §4.2.2, every subgoal pursued (Γ = ∅) in AU: an AND-decomposed goal none
 * of whose subgoals failed passes to AS, unless a Fail condition holds; an
 * OR-decomposed goal none of whose subgoals succeeded fails, unless a
 * Succeed condition holds.
 */
export const decompositionEnd = (
  goal: GoalInstance,
  beliefs: Beliefs,
): Transition | null => {
  if (goal.state !== 'AU' || goal.gamma.length) return null;
  const { E } = goal.instantiation;
  if (goal.relation === 'AND')
    return holds(E, 'Fail', beliefs)
      ? null
      : { rule: 'AND:subg-succeed', state: 'AS', gamma: [] };
  return holds(E, 'Succeed', beliefs)
    ? null
    : { rule: 'OR:subg-fail', state: 'AF', gamma: [] };
};

/**
 * The condition rule that fires, by the order of the pairs that enable
 * them; none when no rule's premises hold.
 */
export const conditionTransition = (
  goal: GoalInstance,
  beliefs: Beliefs,
): Transition | null => {
  const set = setOf(goal);
  const enabled = CONDITION_RULES.flatMap((rule) => {
    if (
      !rule.from.includes(goal.state) ||
      (rule.gamma === 'empty') !== (goal.gamma.length === 0)
    )
      return [];
    const at = trueAt(set, rule.action, beliefs);
    if (at < 0 || (rule.premise && !rule.premise(goal, beliefs))) return [];
    const to = rule.to(goal);
    const changes =
      to.dropped !== undefined ||
      to.state !== goal.state ||
      to.gamma.length !== goal.gamma.length;
    return changes ? [{ at, transition: { rule: rule.name, ...to } }] : [];
  });
  enabled.sort((a, b) => a.at - b.at);
  return enabled[0]?.transition ?? null;
};

/** The transition a goal makes now, without adopting a subgoal; none when it waits. */
export const nextTransition = (
  goal: GoalInstance,
  beliefs: Beliefs,
  deliberate: () => readonly string[],
): Transition | null =>
  deliberation(goal, deliberate) ??
  decompositionEnd(goal, beliefs) ??
  conditionTransition(goal, beliefs);

/**
 * §4.2.2: a subgoal γ may be adopted from AU with Γ ≠ ∅ only when no
 * condition triggers success or failure: "¬∃⟨c, a⟩ ∈ C . (B |= c) ∧ a ∈
 * {Fail, Succeed}" ("transitions triggered by true conditions have
 * precedence over adopting a new subgoal").
 */
export const mayAdopt = (goal: GoalInstance, beliefs: Beliefs): boolean =>
  goal.state === 'AU' &&
  goal.gamma.length > 0 &&
  !holds(goal.instantiation.C, 'Fail', beliefs) &&
  !holds(goal.instantiation.C, 'Succeed', beliefs);

/**
 * §4.2.2: the subgoal γ, adopted, returned with success(γ) or failure(γ) in
 * B′. AND: [AND:subg-achieve] stays in AU, [AND:subg-fail] fails; OR:
 * [OR:subg-achieve] stays in AU, [OR:subg-succeed] succeeds. γ leaves Γ.
 */
export const subgoalTransition = (
  goal: GoalInstance,
  subgoal: string,
  outcome: 'success' | 'failure',
): Transition => {
  const gamma = goal.gamma.filter((id) => id !== subgoal);
  if (goal.relation === 'AND')
    return outcome === 'success'
      ? { rule: 'AND:subg-achieve', state: 'AU', gamma }
      : { rule: 'AND:subg-fail', state: 'AF', gamma };
  return outcome === 'success'
    ? { rule: 'OR:subg-succeed', state: 'AS', gamma }
    : { rule: 'OR:subg-achieve', state: 'AU', gamma };
};

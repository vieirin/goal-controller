/**
 * AAMAS 2009 §4.3: the goal types as instances of the abstract
 * architecture, each a pair of condition–action sets: E, evaluated when the
 * goal's subgoal list Γ is empty, and C, when it isn't (§4.1). The order a
 * set lists its pairs is the order rules take precedence in (§4.2.5: "the
 * order of definition of the conditions at the instantiation of a goal"),
 * H's first.
 */
import type { Action } from '../vocabulary';
import { FALSE, not, or, TRUE, type Condition } from './conditions';

/** ⟨condition, action⟩ */
export type Pair = { condition: Condition; action: Action };

/** A goal type's instance: its name as the paper writes it, and E and C. */
export type Instantiation = {
  name: string;
  E: readonly Pair[];
  C: readonly Pair[];
};

const pair = (condition: Condition, action: Action): Pair => ({
  condition,
  action,
});

/**
 * §4.3.1, a perform-goal: "P ≡ g(E, C), with E = C = {⟨true, Activate⟩,
 * ⟨true, DropFailure⟩, ⟨true, DropSuccess⟩}": its subgoals decide, all of
 * them (AND) or one (OR); no condition is evaluated.
 */
export const perform = (): Instantiation => {
  const set = [
    pair(TRUE, 'Activate'),
    pair(TRUE, 'DropFailure'),
    pair(TRUE, 'DropSuccess'),
  ];
  return { name: 'P', E: set, C: set };
};

/**
 * §4.3.2, an achieve-goal with success condition s and failure (drop)
 * condition f, behaviour a) (`restart`):
 *
 *   A(s, f) ≡ g(E, C), with E = H ∪ {⟨¬s ∨ f, Fail⟩}
 *                      and C = H ∪ {⟨f, Fail⟩, ⟨¬s, Retry⟩}
 *   H = {⟨true, Activate⟩, ⟨d, DropFailure⟩, ⟨s, Succeed⟩,
 *        ⟨s, DropSuccess⟩, ⟨¬s, Reactivate⟩}
 *
 * H's d is the goal's drop condition, which for an achieve-goal is f ("a
 * failure condition (or drop condition) f"). "Behaviour b) can be obtained
 * from the previous one replacing ⟨¬s, Reactivate⟩ with ⟨¬s, DropFailure⟩"
 * (`drop`).
 */
export const achieve = (
  s: Condition,
  f: Condition = FALSE,
  onFailure: 'restart' | 'drop' = 'restart',
): Instantiation => {
  const H = [
    pair(TRUE, 'Activate'),
    pair(f, 'DropFailure'),
    pair(s, 'Succeed'),
    pair(s, 'DropSuccess'),
    pair(not(s), onFailure === 'restart' ? 'Reactivate' : 'DropFailure'),
  ];
  return {
    name: `A(${s.text}, ${f.text})${onFailure === 'drop' ? ' b)' : ''}`,
    E: [...H, pair(or(not(s), f), 'Fail')],
    C: [...H, pair(f, 'Fail'), pair(not(s), 'Retry')],
  };
};

/**
 * §4.3.3, a reactive maintain-goal with maintain condition m and drop
 * condition d:
 *
 *   M(m, d) ≡ g(E, C), with E = H ∪ {⟨¬m ∨ d, Fail⟩}
 *                      and C = H ∪ {⟨d, Fail⟩, ⟨¬m, Retry⟩}, where
 *   H = {⟨¬m, Activate⟩, ⟨d, DropFailure⟩, ⟨m, Succeed⟩,
 *        ⟨m, Suspend⟩, ⟨¬m, Reactivate⟩}
 *
 * With a target condition t, M(m, t, d): "all occurrences of m in M(m, d)
 * changed to t, except for ⟨¬m, Activate⟩": it activates when m is violated
 * and suspends only once t holds.
 */
export const maintain = (
  m: Condition,
  d: Condition = FALSE,
  t?: Condition,
): Instantiation => {
  const kept = t ?? m;
  const H = [
    pair(not(m), 'Activate'),
    pair(d, 'DropFailure'),
    pair(kept, 'Succeed'),
    pair(kept, 'Suspend'),
    pair(not(kept), 'Reactivate'),
  ];
  return {
    name: t ? `M(${m.text}, ${t.text}, ${d.text})` : `M(${m.text}, ${d.text})`,
    E: [...H, pair(or(not(kept), d), 'Fail')],
    C: [...H, pair(d, 'Fail'), pair(not(kept), 'Retry')],
  };
};

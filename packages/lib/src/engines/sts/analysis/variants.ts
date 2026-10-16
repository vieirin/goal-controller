/**
 * Which relations can hold together in a variant (DKE Defs. 6–7, #160
 * D-G10). An atom per goal element is "the actor pursues it in its
 * strategy". A root goal of an actor's own is pursued. A goal received by
 * delegation is pursued exactly when a delegator pursues the goal it
 * delegates (Def. 7: delegated goals are in the delegatee's strategy;
 * Def. 6: otherwise a delegated root may be pruned). An AND-decomposed goal
 * pursued pursues every subgoal, an OR-decomposed one exactly one (Def. 6),
 * and a subgoal is pursued only under its parent. A finding needs some
 * variant with what it reads (S3 App. B: "any possibility"), and one that
 * reads two relations needs both in the same variant; the solver is
 * `satisfiable` (../../propositional).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import { satisfiable } from '../../propositional';
import type { StsIndex } from './graph';

const atom = (goal: string): AssertionTree => ({
  kind: 'var',
  variable: `pursued:${goal}`,
});
const not = (expr: AssertionTree): AssertionTree => ({ kind: 'not', expr });
const and = (items: readonly AssertionTree[]): AssertionTree =>
  items.length === 0
    ? { kind: 'bool', value: true }
    : items.reduce((left, right) => ({ kind: 'and', left, right }));
const or = (items: readonly AssertionTree[]): AssertionTree =>
  items.length === 0
    ? { kind: 'bool', value: false }
    : items.reduce((left, right) => ({ kind: 'or', left, right }));
const implies = (a: AssertionTree, b: AssertionTree): AssertionTree =>
  or([not(a), b]);
const iff = (a: AssertionTree, b: AssertionTree): AssertionTree =>
  and([implies(a, b), implies(b, a)]);

/** Exactly one of `items`. */
const exactlyOne = (items: readonly AssertionTree[]): AssertionTree =>
  and([
    or(items),
    ...items.flatMap((a, i) => items.slice(i + 1).map((b) => not(and([a, b])))),
  ]);

/** The constraints every variant satisfies, over the model's goals. */
const variantConstraints = (index: StsIndex): AssertionTree => {
  const clauses: AssertionTree[] = [];
  for (const goal of index.model.goals) {
    const g = atom(goal.id);
    const parents = index.parentsOf(goal.id);
    const incoming = index.delegationsTo(goal.id);
    for (const parent of parents) clauses.push(implies(g, atom(parent.goal)));
    if (incoming.length)
      clauses.push(iff(g, or(incoming.map((d) => atom(d.goal)))));
    else if (!parents.length) clauses.push(g);
    const decomposition = index.decompositionOf(goal.id);
    if (decomposition) {
      const subs = decomposition.subgoals.map(atom);
      clauses.push(
        decomposition.type === 'and'
          ? and(subs.map((s) => implies(g, s)))
          : implies(g, exactlyOne(subs)),
      );
    }
  }
  return and(clauses);
};

export type Variants = {
  /** Whether some variant pursues every one of these goals. */
  possible: (goals: readonly string[]) => boolean;
  /** Whether some variant satisfies `condition`, a formula over `pursuedAtom`s. */
  possibleThat: (condition: AssertionTree) => boolean;
};

/** The variants of a model, as the solver reads them. */
export const variantsOf = (index: StsIndex): Variants => {
  const constraints = variantConstraints(index);
  const cache = new Map<string, boolean>();
  const possibleThat = (condition: AssertionTree) =>
    satisfiable(constraints, [condition]).satisfiable;
  return {
    possible: (goals) => {
      const key = [...new Set(goals)].sort().join('\n');
      let result = cache.get(key);
      if (result === undefined) {
        result = possibleThat(and([...new Set(goals)].map(atom)));
        cache.set(key, result);
      }
      return result;
    },
    possibleThat,
  };
};

export const pursuedAtom = atom;
export const formula = { not, and, or, implies };

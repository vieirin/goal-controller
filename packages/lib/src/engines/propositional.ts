/**
 * Propositional reasoning over assertion trees (goal-controller#152, #151
 * D7): whether a formula is satisfiable under assumptions, whether one
 * implies another, whether two are equivalent. Atoms are what an assertion
 * names, each a boolean: a ref or a variable (`C5`), a member
 * (`room.clean`); `x = true` is the atom `x`, `x != true` and `x = false`
 * its negation. A comparison (`x > 3`) or a call (`previous(on)`) is an
 * opaque atom, by its text, and the result lists it under `opaque`: an
 * unsatisfiable verdict stays sound, a satisfiable one may not be (no
 * arithmetic). Trees only: nothing here reads a formula's text. The solver
 * is a DPLL over the formula's Tseitin clauses, in TypeScript.
 */
import type { AssertionTree } from '@goal-controller/goal-language';

/** A value for each atom, by its text (`C5`, `room.clean`, `x > 3`). */
export type Assignment = Readonly<Record<string, boolean>>;

export type Satisfiability =
  | {
      satisfiable: true;
      /** a value for every atom of the formula and the assumptions */
      model: Assignment;
      /** the opaque atoms (comparisons, calls), by text */
      opaque: readonly string[];
    }
  | {
      satisfiable: false;
      /**
       * the indices of a minimal set of assumptions the formula conflicts
       * with (empty: it is unsatisfiable on its own)
       */
      conflict: readonly number[];
      opaque: readonly string[];
    };

/** Whether `a → b` (or `a ↔ b`) holds under the assumptions, and an assignment where it doesn't. */
export type Entailment =
  | { holds: true; opaque: readonly string[] }
  | { holds: false; counterexample: Assignment; opaque: readonly string[] };

/** Whether `formula` and every assumption can hold together. */
export const satisfiable = (
  formula: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Satisfiability => {
  throw new Error('satisfiable: not implemented yet');
};

/** Whether every assignment satisfying the assumptions and `a` satisfies `b`. */
export const implies = (
  a: AssertionTree,
  b: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Entailment => {
  throw new Error('implies: not implemented yet');
};

/** Whether `a` and `b` agree on every assignment satisfying the assumptions. */
export const equivalent = (
  a: AssertionTree,
  b: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Entailment => {
  throw new Error('equivalent: not implemented yet');
};

/** A formula's atoms, by text, in the order written. */
export const atomsOf = (formula: AssertionTree): string[] => {
  throw new Error('atomsOf: not implemented yet');
};

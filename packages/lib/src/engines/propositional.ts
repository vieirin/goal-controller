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
import {
  assertionText,
  type AssertionTree,
} from '@goal-controller/goal-language';

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

/** A formula as the solver reads it: atoms by index, constants, connectives. */
type Formula =
  | { kind: 'const'; value: boolean }
  | { kind: 'atom'; atom: number }
  | { kind: 'not'; expr: Formula }
  | { kind: 'and' | 'or'; left: Formula; right: Formula };

/** An atom of a tree: its text, whether the tree's node is its negation, whether it is opaque. */
const atomOf = (
  tree: AssertionTree,
): { text: string; negated: boolean; opaque: boolean } | null => {
  switch (tree.kind) {
    case 'var':
      return { text: tree.variable, negated: false, opaque: false };
    case 'member':
      return {
        text: `${tree.ref}.${tree.member}`,
        negated: false,
        opaque: false,
      };
    case 'assign':
      return {
        text: tree.member ? `${tree.variable}.${tree.member}` : tree.variable,
        negated: tree.value === !!tree.negated,
        opaque: false,
      };
    case 'compare':
    case 'comparison':
    case 'call':
      return { text: assertionText(tree), negated: false, opaque: true };
    default:
      return null;
  }
};

/** The atoms of the formulas one question reads, numbered from 1 in the order written. */
class Atoms {
  readonly texts: string[] = [];
  readonly opaque: string[] = [];
  private readonly index = new Map<string, number>();

  read(tree: AssertionTree | null): Formula {
    if (!tree) throw new Error('an incomplete assertion has no truth value');
    switch (tree.kind) {
      case 'and':
      case 'or':
        return {
          kind: tree.kind,
          left: this.read(tree.left),
          right: this.read(tree.right),
        };
      case 'not':
        return { kind: 'not', expr: this.read(tree.expr) };
      case 'paren':
        return this.read(tree.expr);
      case 'bool':
        return { kind: 'const', value: tree.value };
    }
    const atom = atomOf(tree)!;
    let index = this.index.get(atom.text);
    if (index === undefined) {
      this.texts.push(atom.text);
      index = this.texts.length;
      this.index.set(atom.text, index);
      if (atom.opaque) this.opaque.push(atom.text);
    }
    const read: Formula = { kind: 'atom', atom: index };
    return atom.negated ? { kind: 'not', expr: read } : read;
  }
}

/**
 * Clauses (DIMACS literals: a variable's index, negative when negated) for
 * formulas over `atoms` variables: each formula's Tseitin variable, whose
 * unit clause asserts it.
 */
class Clauses {
  readonly clauses: number[][] = [];
  private variables: number;
  private truth: number | undefined;

  constructor(atoms: number) {
    this.variables = atoms;
  }

  get count(): number {
    return this.variables;
  }

  /** A literal equivalent to `formula`. */
  literal(formula: Formula): number {
    switch (formula.kind) {
      case 'atom':
        return formula.atom;
      case 'not':
        return -this.literal(formula.expr);
      case 'const': {
        if (this.truth === undefined) {
          this.truth = ++this.variables;
          this.clauses.push([this.truth]);
        }
        return formula.value ? this.truth : -this.truth;
      }
      case 'and':
      case 'or': {
        const a = this.literal(formula.left);
        const b = this.literal(formula.right);
        const gate = ++this.variables;
        if (formula.kind === 'and')
          this.clauses.push([-gate, a], [-gate, b], [gate, -a, -b]);
        else this.clauses.push([gate, -a], [gate, -b], [-gate, a, b]);
        return gate;
      }
    }
  }
}

/**
 * A DPLL with unit propagation: values (1 true, -1 false) for the first
 * `atoms` variables that satisfy every clause, or null. It branches on atoms
 * only, false first (a model sets what it needn't to false): once every atom
 * has a value, propagation gives every Tseitin variable one.
 */
const solve = (
  clauses: readonly (readonly number[])[],
  variables: number,
  atoms: number,
): Int8Array | null => {
  const values = new Int8Array(variables + 1);
  const valueOf = (literal: number) =>
    literal > 0 ? values[literal]! : -values[-literal]!;
  const trail: number[] = [];
  const assign = (literal: number) => {
    values[Math.abs(literal)] = literal > 0 ? 1 : -1;
    trail.push(Math.abs(literal));
  };
  const undo = (to: number) => {
    while (trail.length > to) values[trail.pop()!] = 0;
  };
  // false on a conflict
  const propagate = (): boolean => {
    for (let changed = true; changed;) {
      changed = false;
      for (const clause of clauses) {
        let open: number | undefined;
        let opens = 0;
        let satisfied = false;
        for (const literal of clause) {
          const value = valueOf(literal);
          if (value > 0) {
            satisfied = true;
            break;
          }
          if (value === 0) {
            open = literal;
            opens++;
          }
        }
        if (satisfied) continue;
        if (opens === 0) return false;
        if (opens === 1) {
          assign(open!);
          changed = true;
        }
      }
    }
    return true;
  };
  const search = (): boolean => {
    if (!propagate()) return false;
    let next = 1;
    while (next <= atoms && values[next] !== 0) next++;
    if (next > atoms)
      return clauses.every((clause) => clause.some((l) => valueOf(l) > 0));
    const mark = trail.length;
    for (const literal of [-next, next]) {
      assign(literal);
      if (search()) return true;
      undo(mark);
    }
    return false;
  };
  return search() ? values : null;
};

/** Whether `goals` hold together: a model over the atoms read, or none. */
const check = (atoms: Atoms, goals: readonly Formula[]): Assignment | null => {
  const encoded = new Clauses(atoms.texts.length);
  const units = goals.map((goal) => [encoded.literal(goal)]);
  const values = solve(
    [...encoded.clauses, ...units],
    encoded.count,
    atoms.texts.length,
  );
  return values
    ? Object.fromEntries(
        atoms.texts.map((text, i) => [text, values[i + 1]! > 0]),
      )
    : null;
};

/**
 * Whether `formula` and every assumption hold together; when they don't and
 * `conflict` is asked for, a minimal set of assumptions it conflicts with
 * (one more check per assumption).
 */
const decide = (
  formula: AssertionTree,
  assumptions: readonly AssertionTree[],
  conflicts: boolean,
): Satisfiability => {
  const atoms = new Atoms();
  const goal = atoms.read(formula);
  const assumed = assumptions.map((assumption) => atoms.read(assumption));
  const opaque = [...atoms.opaque];
  const model = check(atoms, [goal, ...assumed]);
  if (model) return { satisfiable: true, model, opaque };
  if (!conflicts) return { satisfiable: false, conflict: [], opaque };
  // drop each assumption the rest still conflict without
  const all = assumed.map((_, i) => i);
  let conflict = all;
  if (!check(atoms, [goal])) conflict = [];
  else
    for (const i of all) {
      const without = conflict.filter((j) => j !== i);
      if (!check(atoms, [goal, ...without.map((j) => assumed[j]!)]))
        conflict = without;
    }
  return { satisfiable: false, conflict, opaque };
};

/** Whether `formula` and every assumption can hold together. */
export const satisfiable = (
  formula: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Satisfiability => decide(formula, assumptions, true);

/** `a & !b`, or with `both`, `a` and `b` differing: what refutes an entailment. */
const refutation = (
  a: AssertionTree,
  b: AssertionTree,
  both: boolean,
): AssertionTree => {
  const differ = (x: AssertionTree, y: AssertionTree): AssertionTree => ({
    kind: 'and',
    left: x,
    right: { kind: 'not', expr: y },
  });
  return both
    ? { kind: 'or', left: differ(a, b), right: differ(b, a) }
    : differ(a, b);
};

const entailment = (read: Satisfiability): Entailment =>
  read.satisfiable
    ? { holds: false, counterexample: read.model, opaque: read.opaque }
    : { holds: true, opaque: read.opaque };

/** Whether every assignment satisfying the assumptions and `a` satisfies `b`. */
export const implies = (
  a: AssertionTree,
  b: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Entailment =>
  entailment(decide(refutation(a, b, false), assumptions, false));

/** Whether `a` and `b` agree on every assignment satisfying the assumptions. */
export const equivalent = (
  a: AssertionTree,
  b: AssertionTree,
  assumptions: readonly AssertionTree[] = [],
): Entailment => entailment(decide(refutation(a, b, true), assumptions, false));

/** A formula's atoms, by text, in the order written. */
export const atomsOf = (formula: AssertionTree): string[] => {
  const atoms = new Atoms();
  atoms.read(formula);
  return atoms.texts;
};

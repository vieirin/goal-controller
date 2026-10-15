/**
 * A context formula in SMT-LIB 2 (#151 D1.2): what the oracle's z3
 * re-checks the analyses' satisfiability and implication verdicts with.
 * Each name is a boolean constant, quoted (`|F7.1|`).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import { namesOf } from './formulas';

export const smtFormula = (tree: AssertionTree | null): string => {
  if (!tree) return 'true';
  switch (tree.kind) {
    case 'var':
      return `|${tree.variable}|`;
    case 'assign': {
      const atom = `|${tree.variable}|`;
      return tree.value !== !!tree.negated ? atom : `(not ${atom})`;
    }
    case 'not':
      return `(not ${smtFormula(tree.expr)})`;
    case 'paren':
      return smtFormula(tree.expr);
    case 'and':
    case 'or':
      return `(${tree.kind} ${smtFormula(tree.left)} ${smtFormula(tree.right)})`;
    case 'bool':
      return String(tree.value);
    default:
      throw new Error(
        `A context is a formula of names: ${tree.kind} is not written`,
      );
  }
};

/** The boolean constants a set of formulas needs declared, each once. */
export const smtAtoms = (
  trees: readonly (AssertionTree | null)[],
): string[] => [...new Set(trees.flatMap((tree) => namesOf(tree)))];

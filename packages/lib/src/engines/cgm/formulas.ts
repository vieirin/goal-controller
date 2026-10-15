/**
 * Contexts as formulas (REJ 2010 §3.4, goal-controller#151 D2–D3): what a
 * formula names, whether a context is monitorable (Defs. 6–7: every
 * statement it names supported, transitively, down to facts, with no
 * cycle), and a formula's truth in a situation. Formulas are read with the
 * goal language's `readAssertion`, never split as text.
 */
import {
  readAssertion,
  type AssertionTree,
} from '@goal-controller/goal-language';
import { CGM_KEYS, CGM_KINDS } from './vocabulary';

/** An element as these rules read it: its kind and properties, by id. */
export type FormulaElement = {
  kind: string;
  properties: Readonly<Partial<Record<string, string>>>;
};
export type FormulaLookup = (id: string) => FormulaElement | undefined;

/** A formula's tree; none when it is empty or isn't an assertion. */
export const formulaOf = (text: string | undefined): AssertionTree | null =>
  text?.trim() ? readAssertion(text) : null;

/** The names a formula reads, in the order written, each once. */
export const namesOf = (tree: AssertionTree | null): string[] => {
  const names: string[] = [];
  const walk = (node: AssertionTree | null): void => {
    switch (node?.kind) {
      case 'and':
      case 'or':
        walk(node.left);
        walk(node.right);
        return;
      case 'not':
      case 'paren':
        walk(node.expr);
        return;
      case 'var':
      case 'assign':
        if (!names.includes(node.variable)) names.push(node.variable);
        return;
      default:
        return;
    }
  };
  walk(tree);
  return names;
};

/** The formula an element is specified or supported by: a context's `formula`, a statement's `supportedBy`. */
const definitionOf = (element: FormulaElement): string | undefined =>
  element.kind === CGM_KINDS.context
    ? element.properties[CGM_KEYS.formula]
    : element.kind === CGM_KINDS.statement
      ? element.properties[CGM_KEYS.supportedBy]
      : undefined;

/**
 * Why the formula's statements are not monitorable (Defs. 6–7): a
 * statement without a supporting formula, one supported through a cycle,
 * or a name that is no statement or fact. Null: every statement it names
 * is supported, transitively, down to facts.
 */
export const monitorabilityProblem = (
  text: string | undefined,
  lookup: FormulaLookup,
): string | null => {
  const problems: string[] = [];
  const done = new Set<string>();
  const visit = (name: string, path: readonly string[]): void => {
    if (path.includes(name)) {
      problems.push(
        `${[...path.slice(path.indexOf(name)), name].join(' → ')} is a support cycle`,
      );
      return;
    }
    if (done.has(name)) return;
    done.add(name);
    const element = lookup(name);
    if (!element) return; // an unknown name is the value's own error
    if (element.kind === CGM_KINDS.fact) return;
    if (element.kind !== CGM_KINDS.statement) {
      problems.push(`${name} is neither a statement nor a fact`);
      return;
    }
    const support = element.properties[CGM_KEYS.supportedBy];
    if (!support?.trim()) {
      problems.push(`statement ${name} is supported by no formula`);
      return;
    }
    for (const next of namesOf(formulaOf(support)))
      visit(next, [...path, name]);
  };
  for (const name of namesOf(formulaOf(text))) visit(name, []);
  return problems.length
    ? `Not monitorable (REJ 2010 Defs. 6–7): ${problems.join('; ')}`
    : null;
};

/**
 * A formula with each context and statement it names replaced by what
 * specifies it (a context's formula, a statement's supporting formula), down
 * to facts (REJ 2010 §5.1: "the conjunction of the formulae of facts of the
 * contexts"). A context or statement without one stays a name, as does one
 * reached again through a cycle.
 */
export const expandToFacts = (
  tree: AssertionTree | null,
  lookup: FormulaLookup,
  through: readonly string[] = [],
): AssertionTree | null => {
  if (!tree) return null;
  switch (tree.kind) {
    case 'and':
    case 'or':
      return {
        kind: tree.kind,
        left: expandToFacts(tree.left, lookup, through),
        right: expandToFacts(tree.right, lookup, through),
      };
    case 'not':
    case 'paren':
      return {
        kind: tree.kind,
        expr: expandToFacts(tree.expr, lookup, through),
      };
    case 'var': {
      const element = lookup(tree.variable);
      const definition = element && definitionOf(element);
      const read = definition?.trim() ? formulaOf(definition) : null;
      if (!read || through.includes(tree.variable)) return tree;
      return {
        kind: 'paren',
        expr: expandToFacts(read, lookup, [...through, tree.variable]),
      };
    }
    default:
      return tree;
  }
};

/** A formula's value under an assignment of its names. */
export const evaluate = (
  tree: AssertionTree | null,
  value: (name: string) => boolean,
): boolean => {
  if (!tree) return true;
  switch (tree.kind) {
    case 'and':
      return evaluate(tree.left, value) && evaluate(tree.right, value);
    case 'or':
      return evaluate(tree.left, value) || evaluate(tree.right, value);
    case 'not':
      return !evaluate(tree.expr, value);
    case 'paren':
      return evaluate(tree.expr, value);
    case 'var':
      return value(tree.variable);
    case 'assign':
      return value(tree.variable) === (tree.negated ? !tree.value : tree.value);
    case 'bool':
      return tree.value;
    default:
      throw new Error(
        `A context is a formula of names: ${tree.kind} is not read`,
      );
  }
};

/**
 * Whether a context, statement or fact holds given the facts that do
 * (REJ 2010 §3.4: a monitorable context applies if the facts of its formula
 * and of its statements' supporting formulas hold). A context without a
 * formula, or a fact, holds iff `holds` says so; so does a statement
 * reached again through a support cycle (the monitorability check reports
 * it).
 */
export const holdsGivenFacts = (
  id: string,
  lookup: FormulaLookup,
  holds: (id: string) => boolean,
  through: readonly string[] = [],
): boolean => {
  const element = lookup(id);
  const definition = element && definitionOf(element);
  if (
    !element ||
    element.kind === CGM_KINDS.fact ||
    !definition?.trim() ||
    through.includes(id)
  )
    return holds(id);
  return evaluate(formulaOf(definition), (name) =>
    holdsGivenFacts(name, lookup, holds, [...through, id]),
  );
};

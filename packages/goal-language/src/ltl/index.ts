export * from './ast.js';
export { parseLtl, type LtlParseError, type LtlParseResult } from './parser.js';
export { printLtl } from './print.js';

import type { LtlNode } from './ast.js';
import { parseLtl } from './parser.js';

/**
 * What is wrong with an `ltl` formula's text (null when it parses): the
 * `formula` value's check for tag `ltl`, ../notation/values.ts. A syntax
 * error is a Problem, never a parse failure — the text is written back
 * unchanged either way.
 */
export const ltlProblem = (text: string): string | null => {
  const { errors } = parseLtl(text);
  return errors.length ? errors[0]!.message : null;
};

/**
 * The object model a formula's predicates, attribute accesses and relation
 * memberships are checked against (goal-controller#385), built by a value's
 * `formula` check (`../notation/values.ts`) from the model's declared
 * Predicate, Entity and Association elements, keyed by id: every
 * predicate's arity, every entity's attributes, every declared relation.
 * Each map empty: that category's names are never flagged — the open world
 * (most formulas in the wild use predicates their model never declares).
 */
export interface SymbolTable {
  readonly predicateArity: ReadonlyMap<string, number>;
  readonly attributesOf: ReadonlyMap<string, ReadonlySet<string>>;
  readonly relations: ReadonlySet<string>;
}

/** `1 argument`, `2 arguments`. */
const argumentsText = (n: number) => `${n} argument${n === 1 ? '' : 's'}`;

/** What is wrong with one node against `symbols` (null: nothing, or nothing to check it against). */
const nodeProblem = (node: LtlNode, symbols: SymbolTable): string | null => {
  switch (node.kind) {
    case 'predicateCall': {
      if (symbols.predicateArity.size === 0) return null;
      const arity = symbols.predicateArity.get(node.name);
      if (arity === undefined)
        return `${node.name} is not a declared predicate`;
      return arity === node.args.length
        ? null
        : `${node.name} takes ${argumentsText(arity)}, not ${node.args.length}`;
    }
    case 'attributeAccess': {
      const attributes = symbols.attributesOf.get(node.variable);
      if (!attributes) return null;
      return attributes.has(node.attribute)
        ? null
        : `${node.variable} has no attribute ${node.attribute}`;
    }
    case 'relationMembership':
      return symbols.relations.size === 0 ||
        symbols.relations.has(node.relation)
        ? null
        : `${node.relation} is not a declared relation`;
    default:
      return null;
  }
};

/** Every direct child of a node a type problem could be in. */
const childrenOf = (node: LtlNode): readonly LtlNode[] => {
  switch (node.kind) {
    case 'forall':
    case 'exists':
      return [node.body];
    case 'iff':
    case 'implies':
    case 'strongImplies':
    case 'or':
    case 'and':
    case 'until':
    case 'release':
    case 'weakUntil':
    case 'comparison':
      return [node.left, node.right];
    case 'not':
    case 'next':
    case 'previous':
    case 'eventually':
    case 'once':
    case 'always':
    case 'historically':
    case 'atLabel':
    case 'paren':
      return [node.expr];
    default:
      return [];
  }
};

/**
 * Every Problem a formula's predicate calls, attribute accesses and
 * relation memberships have against `symbols` (an unknown predicate, a
 * wrong arity, an unknown attribute, an unknown relation), walking the
 * whole tree (goal-controller#211, goal-controller#385).
 */
export const ltlTypeProblems = (
  formula: LtlNode,
  symbols: SymbolTable,
): readonly string[] => {
  const problems: string[] = [];
  const visit = (node: LtlNode): void => {
    const problem = nodeProblem(node, symbols);
    if (problem) problems.push(problem);
    for (const child of childrenOf(node)) visit(child);
  };
  visit(formula);
  return problems;
};

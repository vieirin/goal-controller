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
 * The object model a formula's predicates and attributes would be checked
 * against (goal-controller#194 items 1-2, in flight; out of scope here).
 * `symbols` names what the follow-up PR's checker needs: every predicate's
 * arity, every entity's declared attributes. Until that PR wires a real
 * `SymbolTable` in, `ltlTypeProblems` always returns no Problems — a
 * formula's well-formedness against the model is not checked yet.
 */
export interface SymbolTable {
  readonly predicateArity: ReadonlyMap<string, number>;
  readonly attributesOf: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * The hook gt194's object-model PR wires up: every Problem a formula's
 * predicates and attribute accesses have against a model's symbols (an
 * unknown predicate, a wrong arity, an attribute the entity doesn't
 * declare). Unimplemented placeholder until then (goal-controller#211,
 * goal-controller#385).
 */
export const ltlTypeProblems = (
  _formula: LtlNode,
  _symbols: SymbolTable,
): readonly string[] => [];

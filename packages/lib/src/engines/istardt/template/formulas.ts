/**
 * A quality's formula and a condition's, written as `FormulaParser`
 * (dtx2dtg) writes them, from the goal language's trees (`readExpression`,
 * `readAssertion`): the engine never parses a formula's text itself.
 *
 * What dtx2dtg can't write is written as meant and marked unverified in
 * `istardt.md`: a division, a negation of anything but a number, an effect
 * in a quality, a constant or a comparison in a condition.
 */
import type {
  AssertionReading,
  ExpressionTree,
} from '@goal-controller/goal-language';
import type { IstardtElement } from '../model';
import { javaFloat } from '../vocabulary';

/** What a formula's names are: the model's elements, by identifier or id. */
export type Resolve = (name: string) => IstardtElement | undefined;

/** The reasons a formula can't be written. */
export class FormulaError extends Error {}

/** `previous(x)`, the one function iStar-DT has (ER 2024 §3.2). */
export const PREVIOUS = 'previous';

type Term =
  | { kind: 'number'; value: string }
  | { kind: 'atom'; element: IstardtElement; previous: boolean }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: Term; right: Term }
  | { kind: 'negate'; expr: Term };

const atomOf = (
  tree: ExpressionTree,
  resolve: Resolve,
  previous: boolean,
): Term => {
  const name =
    tree.kind === 'var' ? tree.name : tree.kind === 'ref' ? tree.id : null;
  if (name === null)
    throw new FormulaError(
      `previous takes an element's name, not ${tree.kind === 'number' ? tree.value : 'an expression'}`,
    );
  const element = resolve(name);
  if (!element) throw new FormulaError(`${name} names no element`);
  return { kind: 'atom', element, previous };
};

/** An expression as dtx2dtg's formula tree: a negative number is a constant. */
export const termOf = (tree: ExpressionTree, resolve: Resolve): Term => {
  switch (tree.kind) {
    case 'number':
      return { kind: 'number', value: javaFloat(Number(tree.value)) };
    case 'var':
    case 'ref':
      return atomOf(tree, resolve, false);
    case 'call':
      if (tree.name !== PREVIOUS || tree.args.length !== 1)
        throw new FormulaError(
          `${tree.name}/${tree.args.length} is not a function of iStar-DT (previous/1 is)`,
        );
      return atomOf(tree.args[0]!, resolve, true);
    case 'unary':
      return tree.expr.kind === 'number'
        ? { kind: 'number', value: javaFloat(-Number(tree.expr.value)) }
        : { kind: 'negate', expr: termOf(tree.expr, resolve) };
    case 'binary':
      return {
        kind: 'binary',
        operator: tree.operator as '+' | '-' | '*' | '/',
        left: termOf(tree.left, resolve),
        right: termOf(tree.right, resolve),
      };
  }
};

/** `getAtomExpressionForRewardFormulaPart1`: the lookup a quality's clause makes. */
const lookup = ({ element, previous }: Term & { kind: 'atom' }): string => {
  const at = previous ? 's0' : 'S';
  const id = element.identifier;
  switch (element.kind) {
    case 'predicate':
    case 'condition':
      return `val(R_${id}_fl,${id}_fl(${at})),\n`;
    case 'goal':
    case 'task':
    case 'effect':
      return `val(R_${id}_Sat,${id}_Sat(${at})),\n`;
    case 'quality':
    case 'variable':
      return `${id}(R_${id},${at}),\n`;
  }
};

/** `getAtomExpressionForRewardFormulaPart2`: the value a lookup binds. */
const valueOf = ({ element }: Term & { kind: 'atom' }): string => {
  const id = element.identifier;
  switch (element.kind) {
    case 'predicate':
    case 'condition':
      return `R_${id}_fl`;
    case 'goal':
    case 'task':
    case 'effect':
      return `R_${id}_Sat`;
    case 'quality':
    case 'variable':
      return `R_${id}`;
  }
};

/** `parseSimpleQualityExpressionPart1`: the lookups, one per atom, in order. */
export const qualityLookups = (term: Term, indent: string): string => {
  switch (term.kind) {
    case 'number':
      return '';
    case 'atom':
      return indent + lookup(term);
    case 'binary':
      return (
        qualityLookups(term.left, indent) + qualityLookups(term.right, indent)
      );
    case 'negate':
      return qualityLookups(term.expr, indent);
  }
};

/** `parseSimpleQualityExpressionPart2`: the arithmetic, every operand parenthesised. */
export const qualityValue = (term: Term): string => {
  switch (term.kind) {
    case 'number':
      return term.value;
    case 'atom':
      return valueOf(term);
    case 'binary':
      return `(${qualityValue(term.left)}) ${term.operator} (${qualityValue(term.right)})`;
    case 'negate':
      return `-(${qualityValue(term.expr)})`;
  }
};

/**
 * `isOperantOfPrevious`: whether the formula reads the element's previous
 * value (then its clause doesn't add its initial value). As dtx2dtg, a
 * division or a negation is not looked into.
 */
export const readsPreviousOf = (
  element: IstardtElement,
  term: Term,
): boolean => {
  switch (term.kind) {
    case 'atom':
      return term.previous && term.element.identifier === element.identifier;
    case 'binary':
      return (
        term.operator !== '/' &&
        (readsPreviousOf(element, term.right) ||
          readsPreviousOf(element, term.left))
      );
    default:
      return false;
  }
};

/** An atom in a condition: a goal's or task's satisfaction, a fluent, a value. */
const conditionAtom = (element: IstardtElement): string => {
  const id = element.identifier;
  switch (element.kind) {
    case 'goal':
    case 'task':
      return `${id}_Sat(S)`;
    case 'predicate':
    case 'condition':
      return `${id}_fl(S)`;
    default:
      return `${id}(S)`;
  }
};

const COMPARATOR: Readonly<Record<string, string>> = {
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '=<',
  '=': '=:=',
  '!=': '=\\=',
};

/** A comparison's side: a number, or an element's value bound before it. */
const side = (
  tree: ExpressionTree,
  resolve: Resolve,
): { prep: string; value: string } => {
  const term = termOf(tree, resolve);
  if (term.kind === 'number') return { prep: '', value: term.value };
  if (term.kind === 'atom') {
    const id = term.element.identifier;
    return {
      prep: `${id}(V_${id},${term.previous ? 's0' : 'S'}),`,
      value: `V_${id}`,
    };
  }
  throw new FormulaError(
    'a comparison in a condition compares names and numbers (dtx2dtg writes nothing else)',
  );
};

/**
 * `parseConditionExpression`: `;` and `,` for or and and, each
 * parenthesised; `\+ (…)` for not; `previous(x)` as `x_fl(s0)`. A
 * comparison is written as meant (dtx2dtg writes `>` as `<`, and fails on a
 * constant).
 */
export const conditionText = (
  tree: AssertionReading | null,
  resolve: Resolve,
): string => {
  if (!tree) throw new FormulaError('an empty condition');
  const write = (node: AssertionReading | null) => conditionText(node, resolve);
  switch (tree.kind) {
    case 'or':
      return `(${write(tree.left)};${write(tree.right)})`;
    case 'and':
      return `(${write(tree.left)},${write(tree.right)})`;
    case 'not':
      return `\\+ (${write(tree.expr)})`;
    case 'paren':
      return write(tree.expr);
    case 'var': {
      const element = resolve(tree.variable);
      if (!element) throw new FormulaError(`${tree.variable} names no element`);
      return conditionAtom(element);
    }
    case 'call': {
      const atom = termOf(tree, resolve);
      if (atom.kind !== 'atom')
        throw new FormulaError('previous takes an element');
      return `${atom.element.identifier}_fl(s0)`;
    }
    case 'assign': {
      const element = resolve(tree.variable);
      if (!element) throw new FormulaError(`${tree.variable} names no element`);
      return tree.value !== Boolean(tree.negated)
        ? conditionAtom(element)
        : `\\+ (${conditionAtom(element)})`;
    }
    case 'bool':
      return tree.value ? 'true' : 'fail';
    case 'comparison': {
      const left = side(tree.left, resolve);
      const right = side(tree.right, resolve);
      return `(${left.prep}${right.prep}${left.value} ${COMPARATOR[tree.operator] ?? tree.operator} ${right.value})`;
    }
  }
};

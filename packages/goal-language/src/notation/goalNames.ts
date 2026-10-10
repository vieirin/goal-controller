/**
 * How an engine reads a goal's text, derived from its dialect: the goal
 * language reads the element line, the dialect says what its operators are,
 * and the notation's construct is its outermost enabled operator (a
 * standalone construct, when written). Engines write no parser: goal-tree
 * builds this one from the definition it is given.
 */
import type {
  AnyDialect,
  NotationDefinition,
  WithNotation,
} from '@goal-controller/dialect';
import {
  errorText,
  parseElementLineIn,
  parseValue,
  type AssertionTree,
  type RtTree,
} from '../parse.js';
import {
  callOperands,
  isEnabled,
  operandIds,
  readNotation,
} from './reading.js';

/**
 * What a notation makes a goal do: its construct, the ids of its operands
 * in the order written, and the arguments of the modifiers that apply to the
 * construct (`{ retry: { G2: 3 } }`, by the modified operand's text).
 */
export type ExecutionDetail<
  C extends string = string,
  M extends string = string,
> = {
  type: C;
  ids: string[];
  modifiers: Partial<Record<M, Record<string, number>>>;
};

/**
 * The execution detail a dialect's reader gives, typed by the dialect: its
 * constructs' names and its modifiers'. A dialect with no notation gives none
 * (`never`); a dialect type whose notation is optional (`AnyDialect`), any.
 */
export type ExecutionDetailOf<D> = D extends {
  notation: { constructs: infer C; modifiers?: infer M };
}
  ? ExecutionDetail<keyof C & string, keyof NonNullable<M> & string>
  : 'notation' extends keyof D
    ? ExecutionDetail
    : never;

export type GoalReading<E = ExecutionDetail> = {
  id: string;
  goalName: string;
  executionDetail: E | null;
};

/** A goal text's reader; a syntax error goes to `onSyntaxError` (by default, the console). */
export type GoalNameParser<E = ExecutionDetail> = (props: {
  goalText: string;
  onSyntaxError?: (message: string) => void;
}) => GoalReading<E>;

/** What a reader needs of a dialect: its name, and its notation if it has one. */
export type ReadingDialect = Pick<AnyDialect, 'name'> & {
  notation?: NotationDefinition;
};

/** The outermost enabled operator of a notation (groups and modifiers looked through). */
const outermost = (
  dialect: WithNotation,
  tree: RtTree | null,
): { construct: string; ids: string[] } | null => {
  switch (tree?.kind) {
    case 'group':
    case 'postfix':
      return outermost(dialect, tree.expr);
    case 'call':
      return isEnabled(dialect, tree.name, 'call')
        ? {
            construct: dialect.notation.operators[tree.name]!,
            ids: callOperands(tree).filter(Boolean),
          }
        : null;
    case 'prefix':
    case 'binary': {
      const form = tree.kind === 'binary' ? 'infix' : 'prefix';
      if (isEnabled(dialect, tree.operator, form))
        return {
          construct: dialect.notation.operators[tree.operator]!,
          ids: operandIds(tree).filter(Boolean),
        };
      // a disabled operator: what is under it
      return tree.kind === 'binary'
        ? (outermost(dialect, tree.left) ?? outermost(dialect, tree.right))
        : outermost(dialect, tree.expr);
    }
    default:
      return null;
  }
};

/**
 * A notation's execution detail in a dialect: a standalone construct when
 * one is written, else the outermost enabled operator's construct with its
 * operands (none: no detail).
 */
export const executionOf = <D extends WithNotation>(
  dialect: D,
  tree: RtTree | null,
): ExecutionDetailOf<D> | null => {
  const said = readNotation(dialect, tree);
  const [standalone] = said.standalone;
  const outer = standalone
    ? { construct: standalone, ids: [] }
    : outermost(dialect, tree);
  if (!outer || (!standalone && !outer.ids.length)) return null;
  const modifiers = Object.fromEntries(
    Object.entries(dialect.notation.modifiers ?? {})
      .filter(
        ([name, modifier]) =>
          modifier.appliesTo.includes(outer.construct) &&
          said.modifiers.has(name),
      )
      .map(([name]) => [name, said.modifiers.get(name)!]),
  );
  // the names are the dialect's: its type says which (ExecutionDetailOf)
  return {
    type: outer.construct,
    ids: outer.ids,
    modifiers,
  } as ExecutionDetailOf<D>;
};

/** A syntax error, as ANTLR's default listener reported it. */
const report = (
  message: string,
  onSyntaxError: ((message: string) => void) | undefined,
) =>
  onSyntaxError ? onSyntaxError(message) : console.error(`line ${message}`);

/**
 * The goal-text reader of a dialect: reads `G1: Name [notation]`, reports
 * syntax errors and the operators the dialect does not enable, and gives the
 * id, the name and the execution detail. A dialect without a notation reads
 * ids and names only.
 */
export const goalNameParserFor =
  <D extends ReadingDialect>(
    dialect: D,
  ): GoalNameParser<ExecutionDetailOf<D>> =>
  ({ goalText, onSyntaxError }) => {
    const read = parseElementLineIn(dialect, goalText);
    for (const error of read.errors) report(errorText(error), onSyntaxError);
    const notation = read.value?.notation ?? null;
    const notated = dialect.notation
      ? (dialect as ReadingDialect & WithNotation)
      : null;
    // a cost bracket (`[W = 1]`) only where the dialect's leaves have costs
    const cost = read.value?.cost ?? null;
    if (cost && dialect.notation?.leafBracket !== 'cost')
      report(
        `1:${Math.max(goalText.indexOf('['), 0)} A cost is not part of ${dialect.name}`,
        onSyntaxError,
      );
    if (notated)
      for (const symbol of readNotation(notated, notation).disabled)
        report(
          `1:${Math.max(goalText.indexOf(symbol, goalText.indexOf('[')), 0)} \`${symbol}\` is not an operator of ${dialect.name}`,
          onSyntaxError,
        );
    return {
      id: read.value?.id ?? '',
      goalName: (read.value?.name ?? '').trim(),
      executionDetail: notated
        ? (executionOf(notated, notation) as ExecutionDetailOf<D>)
        : null,
    };
  };

export type AssertionVariable = { name: string; value: boolean | null };

/**
 * The variables an assertion names (`battery > 20 & !charging`), in the
 * order written: `x = true` sets a value (each time), a name or an integer
 * comparison adds the name once, without one.
 */
export const assertionVariables = (text: string): AssertionVariable[] => {
  if (!text) return [];
  const read = parseValue('assertion', text);
  for (const error of read.errors) report(errorText(error), undefined);
  const variables: AssertionVariable[] = [];
  const named = (name: string) => {
    if (!variables.some((v) => v.name === name))
      variables.push({ name, value: null });
  };
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
      case 'assign':
        // `x != true` names x, without setting it
        if (node.negated) named(node.variable);
        else variables.push({ name: node.variable, value: node.value });
        return;
      case 'compare':
      case 'var':
        named(node.variable);
        return;
      default:
        return;
    }
  };
  walk(read.value);
  return variables;
};

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
  notationExecution,
  readNotation,
  type AssertionVariable,
} from '../members.js';
import {
  errorText,
  parseElementLineIn,
  parseValue,
  type RtTree,
} from '../parse.js';

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
export type ReadingDialect = Pick<AnyDialect, 'name' | 'unlinkedResources'> & {
  notation?: NotationDefinition;
  /** how unique an id is (a view keys a repeated scoped id by its goal) */
  idScope?: AnyDialect['idScope'];
} & Partial<
    /**
     * the kinds it lists, with their prefixes (an extension's own are read
     * too), and what says which of its extension's kinds a view holds
     * (`extensionKindsRead`, goal-controller#132)
     */
    Pick<AnyDialect, 'elements' | 'properties' | 'links' | 'actors'>
  >;

/** @deprecated a notation's `execution(dialect)` (goal-controller#188) */
export const executionOf = <D extends WithNotation>(
  dialect: D,
  tree: RtTree | null,
): ExecutionDetailOf<D> | null => notationExecution(dialect, tree);

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
        ? (notationExecution(notated, notation) as ExecutionDetailOf<D>)
        : null,
    };
  };

export type { AssertionVariable } from '../members.js';

/**
 * @deprecated an assertion's `variables()` (goal-controller#188), which reads
 * the parsed value: this one parses the text again (a syntax error goes to
 * the console)
 */
export const assertionVariables = (text: string): AssertionVariable[] => {
  if (!text) return [];
  const read = parseValue('assertion', text);
  for (const error of read.errors) report(errorText(error), undefined);
  return read.value?.variables() ?? [];
};

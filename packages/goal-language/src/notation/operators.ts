/**
 * The inspector's operator buttons, from the operators a definition enables:
 * one per construct an operator writes, and one per postfix modifier.
 */
import type { AnyDialect, WithNotation } from '@goal-controller/dialect';
import { INFIX_SYMBOLS } from '../catalog.js';
import { readLine } from './lines.js';

type Notation = Pick<AnyDialect, 'name' | 'elements'> & WithNotation;

/** A button writing a construct's notation over the goal's children. */
export type ConstructButton = {
  symbol: string;
  construct: string;
  label: string;
  title: string;
  /** the notation it writes */
  write: (children: readonly string[]) => string;
};

/** A button adding a postfix operator with its argument's default. */
export type ArgumentButton = {
  symbol: string;
  /** what it writes: the symbol and the default */
  text: string;
  label: string;
  title: string;
  /** the constructs it is offered in */
  appliesTo: readonly string[];
  /** whether the notation has it already */
  present: (notation: string) => boolean;
  write: (notation: string) => string;
};

const INFIX: readonly string[] = INFIX_SYMBOLS;

/** A notation read on its own: its operators and the operand it starts with. */
const readNotation = (notation: string) => {
  const prefix = 'G0: x [';
  const read = readLine(
    { elements: { goal: { prefix: 'G', fill: '' } } },
    `${prefix}${notation}]`,
  );
  if (read.kind !== 'element' || !read.notation) return null;
  const first = read.notation.refs[0];
  return {
    operators: read.notation.operators,
    /** where the first operand ends, if the notation starts with one */
    firstOperandEnd:
      first && first.span.from === prefix.length
        ? first.span.to - prefix.length
        : null,
  };
};

/**
 * The inspector's operator buttons: one per construct a binary or standalone
 * operator writes, in the constructs' order (standalone ones last), then one
 * per postfix modifier.
 */
export const operatorsFor = (
  definition: Notation,
): { constructs: ConstructButton[]; arguments: ArgumentButton[] } => {
  const {
    constructs: table,
    operators,
    standalone = {},
    modifiers = {},
  } = definition.notation;
  const order = Object.keys(table);
  const writers = [
    ...Object.entries(operators)
      .filter(([symbol, meaning]) => INFIX.includes(symbol) && meaning in table)
      .map(([symbol, construct]) => ({ symbol, construct, alone: false })),
    ...Object.entries(standalone).map(([symbol, construct]) => ({
      symbol,
      construct,
      alone: true,
    })),
  ];
  const rank = (w: (typeof writers)[number]) =>
    (w.alone ? order.length : 0) + order.indexOf(w.construct);
  return {
    constructs: writers
      .sort((a, b) => rank(a) - rank(b))
      .map(({ symbol, construct, alone }) => {
        // defineDialect checked every operator's construct is declared
        const { label, help } = table[construct]!;
        return {
          symbol,
          construct,
          label,
          title: alone
            ? `${label} (${definition.name} notation: a standalone ${symbol})`
            : `${label}: ${help}`,
          write: (children) => (alone ? symbol : children.join(symbol)),
        };
      }),
    arguments: Object.entries(operators).flatMap(([symbol, meaning]) => {
      const modifier = modifiers[meaning];
      if (!modifier) return [];
      const { argument } = modifier;
      const text = `${symbol}${argument.default}`;
      return [
        {
          symbol,
          text,
          label: argument.name,
          title: modifier.action.replace(
            `{${argument.name}}`,
            String(argument.default),
          ),
          appliesTo: modifier.appliesTo,
          present: (notation: string) =>
            !!readNotation(notation)?.operators.some(
              (op) => op.form === 'postfix' && op.symbol === symbol,
            ),
          write: (notation: string) => {
            const end = readNotation(notation)?.firstOperandEnd;
            return end === null || end === undefined
              ? notation
              : `${notation.slice(0, end)}${text}${notation.slice(end)}`;
          },
        },
      ];
    }),
  };
};

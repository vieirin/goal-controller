/**
 * What the goal language offers every dialect, as data (no parser here, so the
 * dialect package and the browser read it without loading Langium): the RT
 * notation's operator catalog with its fixed precedence, the assertion
 * language's operators and the predefined value types. (The properties an
 * element line's annotations and declaration set are the dialect package's
 * DECLARATION_KEYS and ANNOTATION_KEYS.)
 *
 * A dialect enables operators and names the construct each one means; it
 * cannot add an operator or change how tightly one binds. goal.langium is
 * written from this table (the tests check they agree).
 */

export type OperatorForm =
  | 'infix'
  | 'prefix'
  | 'postfix'
  | 'standalone'
  | 'call';

export type CatalogOperator = {
  symbol: string;
  form: OperatorForm;
  /** 1 binds tightest; operators of one level are left-associative */
  precedence: number;
  assoc: 'left' | 'none';
  example: string;
};

/** Binary operators, tightest first (every one left-associative). */
export const INFIX_SYMBOLS = [
  '^',
  '|',
  '?',
  '+',
  '&',
  '#',
  '~',
  ';',
  '->',
  ',',
] as const;

/** `!G1`: binds tighter than every binary operator, looser than a postfix. */
export const PREFIX_SYMBOLS = ['!'] as const;

/** `G1@3`: a number argument; binds tightest of all, and repeats (`G1@2@3`). */
export const POSTFIX_SYMBOLS = ['@'] as const;

/** `[+]`: the symbol is a whole operand on its own. */
export const STANDALONE_SYMBOLS = ['+', '*', '?', '#'] as const;

/**
 * `FALLBACK(G1,G2)`: a construct written as a call, with the number of
 * operands it takes (MutRoSe's runtime annotations). A call is an operand on
 * its own, like a group: its commas separate operands, they are not `,`.
 */
export const CALLS = { FALLBACK: { arity: 2 } } as const;
export const CALL_NAMES = Object.keys(CALLS) as (keyof typeof CALLS)[];

export type InfixSymbol = (typeof INFIX_SYMBOLS)[number];
export type PrefixSymbol = (typeof PREFIX_SYMBOLS)[number];
export type PostfixSymbol = (typeof POSTFIX_SYMBOLS)[number];
export type StandaloneSymbol = (typeof STANDALONE_SYMBOLS)[number];
export type CallName = keyof typeof CALLS;
/** A symbol a dialect may map to a construct (or, postfix, to a modifier). */
export type OperatorSymbol =
  | InfixSymbol
  | PrefixSymbol
  | PostfixSymbol
  | CallName;

/** The whole catalog, tightest first (standalone symbols have no precedence: 0). */
export const OPERATORS: readonly CatalogOperator[] = [
  ...POSTFIX_SYMBOLS.map((symbol): CatalogOperator => ({
    symbol,
    form: 'postfix',
    precedence: 1,
    assoc: 'left',
    example: `G1${symbol}3`,
  })),
  ...PREFIX_SYMBOLS.map((symbol): CatalogOperator => ({
    symbol,
    form: 'prefix',
    precedence: 2,
    assoc: 'none',
    example: `${symbol}G1`,
  })),
  ...INFIX_SYMBOLS.map((symbol, i): CatalogOperator => ({
    symbol,
    form: 'infix',
    precedence: 3 + i,
    assoc: 'left',
    example: `G1${symbol}G2`,
  })),
  ...STANDALONE_SYMBOLS.map((symbol): CatalogOperator => ({
    symbol,
    form: 'standalone',
    precedence: 0,
    assoc: 'none',
    example: symbol,
  })),
  ...CALL_NAMES.map((symbol): CatalogOperator => ({
    symbol,
    form: 'call',
    precedence: 0,
    assoc: 'none',
    example: `${symbol}(${Array.from({ length: CALLS[symbol].arity }, (_, i) => `G${i + 1}`).join(',')})`,
  })),
];

/** The keyword an operand may be instead of an element id. */
export const SKIP = 'skip';

/** The id prefixes element lines may use (`G1`, `T2.1`, `R3`, MutRoSe's `AT1`). */
export const ID_PREFIXES = ['G', 'T', 'R', 'AT'] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** The assertion language: `battery > 20 & !charging`. */
export const ASSERTION = {
  /** tightest first */
  infix: ['&', '|'],
  /** takes everything after it (`!a & b` is `!(a & b)`) */
  prefix: ['!'],
  parens: ['(', ')'],
  comparators: ['=', '!=', '<', '<=', '>', '>='],
  bool: ['true', 'false'],
} as const;

/**
 * The value types a property may have; each is a rule of the grammar that
 * reads one value on its own (an inspector field).
 *
 * - `assertion`: the assertion language
 * - `int`, `number`, `bool`: `-3`, `-1.5`, `true`
 * - `text`: anything on one line
 * - `enum`: one or more words (`maintain`, `goal-based`)
 * - `refList`: element ids, comma-separated (`G2, G5`)
 * - `pairList`: `name:value` pairs, comma-separated (`x:3, y:2`)
 * - `annotatedName`: `<<stereotype>> {tag = value} Name [RT]`, a line
 *   without an id
 */
export const VALUE_TYPES = [
  'assertion',
  'int',
  'number',
  'bool',
  'text',
  'enum',
  'refList',
  'pairList',
  'annotatedName',
] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

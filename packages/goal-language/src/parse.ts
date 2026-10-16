/**
 * Reading texts of the goal language into plain data (no Langium types, so
 * CommonJS consumers and the browser need none): a document, one element
 * line, or one value of a predefined type.
 */
import type { ParseResult } from 'langium';
import type {
  AssertionPrefix,
  NotationDefinition,
} from '@goal-controller/dialect';
import {
  EXPRESSION,
  idPrefixPattern,
  idPrefixesOf,
  type ValueType,
} from './catalog.js';
import type {
  AnnotatedName,
  Annotation,
  AssertCall,
  AssertCompare,
  AssertExpr,
  AssertionValue,
  BoolValue,
  Cost,
  Declaration,
  Document,
  ElementLine,
  EnumValue,
  EnumSetValue,
  Expr,
  ExprCall,
  ExpressionValue,
  IntValue,
  NumberValue,
  OclValue,
  PairListValue,
  PlainDocument,
  RefListValue,
  RtExpr,
  TextValue,
} from './generated/ast.js';
import type { LexerStart } from './lexer.js';
import {
  createGoalCoreServices,
  parseWith,
  type GoalCoreServices,
} from './module.js';

/** An RT notation, as written (operators as the catalog has them). */
export type RtTree =
  | { kind: 'ref'; id: string }
  | { kind: 'skip' }
  | { kind: 'standalone'; symbol: string }
  | { kind: 'group'; open: string; expr: RtTree | null }
  | { kind: 'prefix'; operator: string; expr: RtTree | null }
  /** `FALLBACK(G1,G2)`: a construct written as a call */
  | { kind: 'call'; name: string; args: (RtTree | null)[] }
  | {
      kind: 'postfix';
      operator: string;
      argument: string;
      expr: RtTree | null;
    }
  | {
      kind: 'binary';
      operator: string;
      left: RtTree | null;
      right: RtTree | null;
    };

/**
 * An expression (the catalog's EXPRESSION), as an engine walks it to write
 * its own syntax. Its parentheses are its shape.
 */
export type ExpressionTree =
  /** as written: `2`, `0.5` */
  | { kind: 'number'; value: string }
  /** an element, by its id: `G1`, `T2.1` */
  | { kind: 'ref'; id: string }
  /** any other name: a variable, declared by its use */
  | { kind: 'var'; name: string }
  /**
   * a member of an element or a variable (`room.clean`, goal-controller#135):
   * `ref` is its id or name, as written, `member` the member's name
   */
  | { kind: 'member'; ref: string; member: string }
  | { kind: 'call'; name: string; args: ExpressionTree[] }
  | {
      kind: 'binary';
      operator: ExpressionOperator;
      left: ExpressionTree;
      right: ExpressionTree;
    }
  | { kind: 'unary'; operator: '-'; expr: ExpressionTree };

export type ExpressionOperator = (typeof EXPRESSION.infix)[number][number];

/**
 * An assertion: AssertionRegex.g4's alternatives, with the comparisons it
 * has (`Comparison`).
 */
export type AssertionNode<Comparison> =
  | {
      kind: 'and' | 'or';
      left: AssertionNode<Comparison> | null;
      right: AssertionNode<Comparison> | null;
    }
  | { kind: 'not'; expr: AssertionNode<Comparison> | null }
  | { kind: 'paren'; expr: AssertionNode<Comparison> | null }
  /**
   * `x = true`; `negated`: `x != true` (CtxRegex.g4's, where a value allows
   * it); `member`: `room.clean = true`, a member of `variable`
   */
  | {
      kind: 'assign';
      variable: string;
      value: boolean;
      negated?: true;
      member?: string;
    }
  | { kind: 'var'; variable: string }
  /** `room.clean`: a member, as a condition on its own (goal-controller#135) */
  | { kind: 'member'; ref: string; member: string }
  | { kind: 'bool'; value: boolean }
  /** `previous(on)`: a call to a function the value declares, as a condition */
  | { kind: 'call'; name: string; args: ExpressionTree[] }
  | Comparison;

/** `x > 3`: a name and a number, as AssertionRegex.g4 read every comparison. */
export type NameComparison = {
  kind: 'compare';
  variable: string;
  operator: string;
  value: string;
};

/** `previous(t) < 18`, `0.9 * x >= 1`: two expressions compared. */
export type ExpressionComparison = {
  kind: 'comparison';
  operator: string;
  left: ExpressionTree;
  right: ExpressionTree;
};

/**
 * An assertion as its engines have read it: a comparison of a name and a
 * number is a `compare`, any other a `comparison` (only an assertion that
 * declares functions may have those).
 */
export type AssertionTree = AssertionNode<
  NameComparison | ExpressionComparison
>;

/** An assertion with every comparison's sides as expressions (`readAssertion`). */
export type AssertionReading = AssertionNode<ExpressionComparison>;

export type AnnotationData =
  | { kind: 'stereotype'; stereotype: string }
  | { kind: 'tag'; tag: string; tagValue?: string };

/** `{int 0..100 = 80}`: the properties it sets, as written. */
export type DeclarationData = {
  type: string;
  lowerBound?: string;
  upperBound?: string;
  initialValue?: string;
};

/**
 * A leaf's cost (`[W = 0.1x]`, GODA's CostRegex.g4): a constant, a variable,
 * or a constant times a variable, as written.
 */
export type CostData = { value: string | null; variable: string | null };

export type ElementLineData = {
  /** `G1`, `T2.1`, ...; empty on a line without an id (an annotated name may have one) */
  id: string;
  /** the name as written, untrimmed (`' Name '` in `G1: Name [G2]`) */
  name: string;
  annotations: AnnotationData[];
  notation: RtTree | null;
  /** what its bracket holds when it is a cost (`[W = 0.1]`), not a notation */
  cost: CostData | null;
  declaration: DeclarationData | null;
};

export type DocumentLine =
  | ({ kind: 'element'; line: number } & ElementLineData)
  | { kind: 'property'; line: number; key: string; value: string };

/** A syntax error: 1-based line, 0-based column (ANTLR's), offset and length. */
export type GoalSyntaxError = {
  line: number;
  column: number;
  offset: number;
  length: number;
  message: string;
};

export type Parsed<T> = { value: T; errors: GoalSyntaxError[] };

/** `line:column message`, as ANTLR's error listener wrote it. */
export const errorText = (error: GoalSyntaxError): string =>
  `${error.line}:${error.column} ${error.message}`;

let services: GoalCoreServices | undefined;
/** The parser services, created on first use. */
export const goalServices = (): GoalCoreServices =>
  (services ??= createGoalCoreServices().Goal);

/** Langium's errors; one at the end of the input (no token) is at `end`. */
export const syntaxErrorsOf = (
  result: ParseResult,
  end = 0,
): GoalSyntaxError[] => [
  ...result.lexerErrors.map((e) => ({
    line: e.line ?? 1,
    column: (e.column ?? 1) - 1,
    offset: e.offset,
    length: e.length,
    message: e.message,
  })),
  ...result.parserErrors.map((e) => {
    const { token } = e;
    // the end of the input has no token (Langium's EOF is at -1)
    const known = Number.isFinite(token.startOffset) && token.startOffset >= 0;
    return {
      line: known ? (token.startLine ?? 1) : 1,
      column: known ? (token.startColumn ?? 1) - 1 : 0,
      offset: known ? token.startOffset : end,
      length: known ? token.image.length : 0,
      message: e.message,
    };
  }),
];

const parse = <T>(
  start: LexerStart,
  text: string,
  prefixes: readonly string[] = [],
  keys: readonly string[] = [],
) => {
  const result = parseWith(goalServices(), start, text, prefixes, keys);
  return {
    root: result.value as T,
    errors: syntaxErrorsOf(result, text.length),
  };
};

// after a syntax error Langium leaves the nodes it could not finish partial
export const toRtTree = (expr: RtExpr | undefined): RtTree | null => {
  switch (expr?.$type) {
    case 'RtRef':
      return expr.ref?.$refText ? { kind: 'ref', id: expr.ref.$refText } : null;
    case 'RtSkip':
      return { kind: 'skip' };
    case 'RtStandalone':
      return { kind: 'standalone', symbol: expr.symbol };
    case 'RtGroup':
      return { kind: 'group', open: expr.open, expr: toRtTree(expr.expr) };
    case 'RtNot':
      return {
        kind: 'prefix',
        operator: expr.operator,
        expr: toRtTree(expr.expr),
      };
    case 'RtArgument':
      return {
        kind: 'postfix',
        operator: expr.operator,
        argument: expr.argument ?? '',
        expr: toRtTree(expr.expr),
      };
    case 'RtCall':
      return {
        kind: 'call',
        name: expr.function,
        args: expr.args.map(toRtTree),
      };
    case 'RtComma':
    case 'RtBinary':
      return {
        kind: 'binary',
        operator: expr.operator,
        left: toRtTree(expr.left),
        right: toRtTree(expr.right),
      };
    default:
      return null;
  }
};

const CLOSE: Record<string, string> = { '[': ']', '(': ')' };

/** A notation's text without whitespace, as ANTLR's `getText()` (edgeV2 keys retries by it). */
export const rtText = (tree: RtTree | null): string => {
  switch (tree?.kind) {
    case 'ref':
      return tree.id;
    case 'skip':
      return 'skip';
    case 'standalone':
      return tree.symbol;
    case 'group':
      return `${tree.open}${rtText(tree.expr)}${CLOSE[tree.open] ?? ''}`;
    case 'prefix':
      return `${tree.operator}${rtText(tree.expr)}`;
    case 'postfix':
      return `${rtText(tree.expr)}${tree.operator}${tree.argument}`;
    case 'binary':
      return `${rtText(tree.left)}${tree.operator}${rtText(tree.right)}`;
    case 'call':
      return `${tree.name}(${tree.args.map(rtText).join(',')})`;
    default:
      return '';
  }
};

const toAnnotation = (annotation: Annotation): AnnotationData =>
  annotation.$type === 'Stereotype'
    ? { kind: 'stereotype', stereotype: annotation.stereotype ?? '' }
    : {
        kind: 'tag',
        tag: annotation.tag ?? '',
        ...(annotation.tagValue !== undefined
          ? { tagValue: annotation.tagValue }
          : {}),
      };

const toDeclaration = (
  declaration: Declaration | undefined,
): DeclarationData | null =>
  declaration
    ? {
        type: declaration.type ?? '',
        ...(declaration.lowerBound !== undefined
          ? { lowerBound: declaration.lowerBound }
          : {}),
        ...(declaration.upperBound !== undefined
          ? { upperBound: declaration.upperBound }
          : {}),
        ...(declaration.initialValue !== undefined
          ? { initialValue: declaration.initialValue }
          : {}),
      }
    : null;

const toCost = (cost: Cost | undefined): CostData | null =>
  cost ? { value: cost.value ?? null, variable: cost.variable ?? null } : null;

export const toElementLine = (
  line: ElementLine | AnnotatedName,
): ElementLineData => ({
  id: line.name ?? '',
  name: line.label ?? '',
  annotations: line.annotations.map(toAnnotation),
  notation: toRtTree(line.notation),
  cost: line.$type === 'ElementLine' ? toCost(line.cost) : null,
  declaration: toDeclaration(line.declaration),
});

const lineOf = (node: { $cstNode?: { range: { start: { line: number } } } }) =>
  (node.$cstNode?.range.start.line ?? 0) + 1;

/**
 * One element line with an id (`G1: Name [G2;G3]`), as an engine reads a
 * goal's text. A blank text has no element and no error (RTRegex.g4's `blank`).
 * `prefixes`: its dialect's own id prefixes (`idPrefixesOf`), if any.
 */
export const parseElementLine = (
  text: string,
  prefixes: readonly string[] = [],
): Parsed<ElementLineData | null> => {
  // RTRegex.g4 skipped tabs only
  if (/^\t*$/.test(text)) return { value: null, errors: [] };
  const { root, errors } = parse<ElementLine>('elementLine', text, prefixes);
  return { value: root ? toElementLine(root) : null, errors };
};

/**
 * A text with the spaces inside its bracket removed (from its first `[` to
 * its last `]`, as GODA's `removeBlankSpaceInBrackets` does before it parses:
 * `T1: Name [D M(T1.1 2)]` reads `[DM(T1.12)]`), and where each offset of
 * the result was in the text as written.
 */
export const withoutBracketSpaces = (
  text: string,
): { text: string; origin: (offset: number) => number } => {
  const open = text.indexOf('[');
  const close = text.lastIndexOf(']');
  if (open < 0 || close < open) return { text, origin: (offset) => offset };
  const kept: number[] = [];
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (i > open && i < close && text[i] === ' ') continue;
    kept.push(i);
    out += text[i];
  }
  return {
    text: out,
    // the end of the text is the end of what was written
    origin: (offset) => (offset < kept.length ? kept[offset]! : text.length),
  };
};

/** An element line's id and colon (annotations and indentation before them), with these prefixes. */
const elementIdOf = (prefixes: readonly string[]) =>
  new RegExp(
    `^\\s*(?:(?:<<[^>]*>>|\\{[^}]*\\})\\s*)*(?:${idPrefixPattern(prefixes)})(?:[0-9][0-9.]*X?|X|[0-9][a-z])\\s*:`,
  );
const ELEMENT_ID = elementIdOf([]);
/** What RTRegex.g4's WORD reads in a name. */
const WORD_CHARACTER = /[A-Za-z\- ']/;

/**
 * An element line whose name is free text (`notation.names: 'text'`),
 * written so the grammar reads its name as a WORD: every other character of
 * the name (up to its bracket or declaration) made a letter, so the line
 * keeps its length and every span. `name` is the name as written.
 */
export const withWordName = (
  text: string,
  prefixes: readonly string[] = [],
): { text: string; name: { from: number; to: number } | null } => {
  const id = (prefixes.length ? elementIdOf(prefixes) : ELEMENT_ID).exec(text);
  if (!id) return { text, name: null };
  const from = id[0].length;
  const end = text.slice(from).search(/[[{]/);
  const to = end < 0 ? text.length : from + end;
  let masked = '';
  for (const ch of text.slice(from, to))
    masked += WORD_CHARACTER.test(ch) ? ch : 'x';
  return {
    text: text.slice(0, from) + masked + text.slice(to),
    name: { from, to },
  };
};

/**
 * One element line read in a dialect: as written, without the spaces in its
 * bracket where the dialect ignores them (`notation.whitespace`), its name
 * read as free text where the dialect's names are (`notation.names`).
 */
export const parseElementLineIn = (
  dialect: {
    notation?: Pick<NotationDefinition, 'whitespace' | 'names'> | undefined;
    /** its kinds' id prefixes: an extension's kinds' it lists are read too */
    elements?: Readonly<Record<string, { prefix?: string } | undefined>>;
  },
  text: string,
): Parsed<ElementLineData | null> => {
  const prefixes = idPrefixesOf(dialect);
  const named =
    dialect.notation?.names === 'text'
      ? withWordName(text, prefixes)
      : { text, name: null };
  const read = parseElementLine(
    dialect.notation?.whitespace === 'ignore'
      ? withoutBracketSpaces(named.text).text
      : named.text,
    prefixes,
  );
  const { name } = named;
  return name && read.value
    ? {
        ...read,
        value: { ...read.value, name: text.slice(name.from, name.to) },
      }
    : read;
};

/**
 * A document: element lines with ids and property lines, or (`ids: false`)
 * lines without ids, and property lines that start with one of `keys`.
 */
export const parseDocument = (
  text: string,
  {
    ids = true,
    prefixes = [],
    keys = [],
  }: {
    ids?: boolean;
    /** its dialect's own id prefixes (`idPrefixesOf`) */
    prefixes?: readonly string[];
    /** without ids, its declared keys (`propertyKeysOf`) */
    keys?: readonly string[];
  } = {},
): Parsed<DocumentLine[]> => {
  const { root, errors } = ids
    ? parse<Document>('document', text, prefixes)
    : parse<PlainDocument>('plainDocument', text, [], keys);
  return {
    value: root.lines.map((line): DocumentLine =>
      line.$type === 'PropertyLine'
        ? {
            kind: 'property',
            line: lineOf(line),
            key: line.key,
            value: line.value ?? '',
          }
        : { kind: 'element', line: lineOf(line), ...toElementLine(line) },
    ),
    errors,
  };
};

/** An expression's tree; null where it is unfinished (after a syntax error). */
export const toExpressionTree = (
  expr: Expr | undefined,
): ExpressionTree | null => {
  switch (expr?.$type) {
    case 'ExprNumber':
      return expr.value ? { kind: 'number', value: expr.value } : null;
    case 'ExprRef':
      return expr.id ? { kind: 'ref', id: expr.id } : null;
    case 'ExprVar':
      return expr.name ? { kind: 'var', name: expr.name } : null;
    case 'ExprMember':
      return expr.ref && expr.member
        ? { kind: 'member', ref: expr.ref, member: expr.member }
        : null;
    case 'ExprParen':
      return toExpressionTree(expr.expr);
    case 'ExprNegation': {
      const operand = toExpressionTree(expr.expr);
      return operand && { kind: 'unary', operator: '-', expr: operand };
    }
    case 'ExprCall':
      return callOf(expr);
    case 'ExprBinary': {
      const left = toExpressionTree(expr.left);
      const right = toExpressionTree(expr.right);
      return left && right && expr.operator
        ? { kind: 'binary', operator: expr.operator, left, right }
        : null;
    }
    default:
      return null;
  }
};

/** A call (`previous(t)`), in an expression or as a condition; null while unfinished. */
const callOf = (
  expr: ExprCall | AssertCall,
): { kind: 'call'; name: string; args: ExpressionTree[] } | null => {
  const args = expr.args.map(toExpressionTree);
  return expr.function && args.every((arg) => arg !== null)
    ? { kind: 'call', name: expr.function, args: args as ExpressionTree[] }
    : null;
};

/** A comparison's two sides as expressions. */
const expressionComparison = (
  expr: AssertCompare,
): ExpressionComparison | null => {
  const left = toExpressionTree(expr.left);
  const right = toExpressionTree(expr.right);
  return left && right && expr.operator
    ? { kind: 'comparison', operator: expr.operator, left, right }
    : null;
};

/** A comparison as AssertionRegex.g4 read it (a name and a number), else as expressions. */
const nameComparison = (
  expr: AssertCompare,
): NameComparison | ExpressionComparison | null => {
  const { left, right } = expr;
  if (
    (left?.$type === 'ExprVar' || left?.$type === 'ExprRef') &&
    right?.$type === 'ExprNumber'
  ) {
    const variable = left.$type === 'ExprVar' ? left.name : left.id;
    return variable && expr.operator && right.value
      ? {
          kind: 'compare',
          variable,
          operator: expr.operator,
          value: right.value,
        }
      : null;
  }
  return expressionComparison(expr);
};

/** An assertion's tree, its comparisons read by `comparison`. */
const assertionOf = <C>(comparison: (expr: AssertCompare) => C | null) => {
  const walk = (expr: AssertExpr | undefined): AssertionNode<C> | null => {
    switch (expr?.$type) {
      case 'AssertBinary':
        return {
          kind: expr.operator === '&' ? 'and' : 'or',
          left: walk(expr.left),
          right: walk(expr.right),
        };
      case 'AssertNot':
        return { kind: 'not', expr: walk(expr.expr) };
      case 'AssertParen':
        return { kind: 'paren', expr: walk(expr.expr) };
      case 'AssertCompare':
        return comparison(expr);
      default:
        return assertionAtom(expr);
    }
  };
  return walk;
};

/** An assertion's atoms besides comparisons: `x = true`, `x`, `true`. */
const assertionAtom = (
  expr: AssertExpr | undefined,
): AssertionNode<never> | null => {
  switch (expr?.$type) {
    case 'AssertAssign':
      return expr.variable && expr.value
        ? {
            kind: 'assign',
            variable: expr.variable,
            value: expr.value === 'true',
            ...(expr.operator === '!=' && { negated: true as const }),
            ...(expr.member && { member: expr.member }),
          }
        : null;
    case 'AssertMember':
      return expr.ref && expr.member
        ? { kind: 'member', ref: expr.ref, member: expr.member }
        : null;
    case 'AssertVar':
      return expr.variable ? { kind: 'var', variable: expr.variable } : null;
    case 'AssertConst':
      return expr.value ? { kind: 'bool', value: expr.value === 'true' } : null;
    case 'AssertCall':
      return callOf(expr);
    default:
      return null;
  }
};

export const toAssertionTree: (
  expr: AssertExpr | undefined,
) => AssertionTree | null = assertionOf(nameComparison);

const toAssertionReading: (
  expr: AssertExpr | undefined,
) => AssertionReading | null = assertionOf(expressionComparison);

/** How tightly each binary operator binds: 0 tightest (the catalog's levels). */
const LEVEL = new Map<string, number>(
  EXPRESSION.infix.flatMap((level, i) =>
    level.map((operator) => [operator, i] as const),
  ),
);

/**
 * An expression's text: `0.5 + 0.9 * previous(t)`, with the parentheses its
 * shape needs and no others. It reads back as the same tree.
 */
export const expressionText = (tree: ExpressionTree): string => {
  switch (tree.kind) {
    case 'number':
      return tree.value;
    case 'ref':
      return tree.id;
    case 'var':
      return tree.name;
    case 'member':
      return `${tree.ref}.${tree.member}`;
    case 'call':
      return `${tree.name}(${tree.args.map(expressionText).join(', ')})`;
    case 'unary': {
      const operand = expressionText(tree.expr);
      return tree.expr.kind === 'binary'
        ? `${tree.operator}(${operand})`
        : `${tree.operator}${operand}`;
    }
    case 'binary': {
      const level = LEVEL.get(tree.operator)!;
      // an operand that binds looser is grouped; on the right, one that binds
      // as tightly too (every operator is left-associative)
      const side = (
        operand: ExpressionTree,
        grouped: (l: number) => boolean,
      ) =>
        operand.kind === 'binary' && grouped(LEVEL.get(operand.operator)!)
          ? `(${expressionText(operand)})`
          : expressionText(operand);
      return `${side(tree.left, (l) => l > level)} ${tree.operator} ${side(tree.right, (l) => l >= level)}`;
    }
  }
};

/**
 * An assertion's text, as read (its groups are its `paren` nodes):
 * `previous(t) < 18 & !on`. It reads back as the same tree.
 */
export const assertionText = (tree: AssertionTree | null): string => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return `${assertionText(tree.left)} ${tree.kind === 'and' ? '&' : '|'} ${assertionText(tree.right)}`;
    case 'not':
      return `!${assertionText(tree.expr)}`;
    case 'paren':
      return `(${assertionText(tree.expr)})`;
    case 'assign':
      return `${tree.variable}${tree.member ? `.${tree.member}` : ''} ${tree.negated ? '!=' : '='} ${tree.value}`;
    case 'member':
      return `${tree.ref}.${tree.member}`;
    case 'compare':
      return `${tree.variable} ${tree.operator} ${tree.value}`;
    case 'comparison':
      return `${expressionText(tree.left)} ${tree.operator} ${expressionText(tree.right)}`;
    case 'call':
      return expressionText(tree);
    case 'var':
      return tree.variable;
    case 'bool':
      return String(tree.value);
    default:
      return '';
  }
};

/** What each value type reads into. */
export type ValueData = {
  assertion: AssertionTree | null;
  expression: ExpressionTree | null;
  int: string | null;
  number: string | null;
  bool: boolean | null;
  text: string | null;
  enum: string | null;
  enumSet: string[];
  refList: string[];
  pairList: { name: string; value: string }[];
  annotatedName: ElementLineData | null;
  /** its tokens, as written */
  ocl: string[];
};

const READ: { [T in ValueType]: (root: never) => ValueData[T] } = {
  assertion: (root: AssertionValue) => toAssertionTree(root.expr),
  expression: (root: ExpressionValue) => toExpressionTree(root.expr),
  int: (root: IntValue) => root.value ?? null,
  number: (root: NumberValue) => root.value ?? null,
  bool: (root: BoolValue) => (root.value ? root.value === 'true' : null),
  text: (root: TextValue) => root.value ?? null,
  enum: (root: EnumValue) => root.value ?? null,
  enumSet: (root: EnumSetValue) => [...root.values],
  refList: (root: RefListValue) => [...root.ids],
  pairList: (root: PairListValue) =>
    root.pairs.map((pair) => ({ name: pair.name, value: pair.value })),
  annotatedName: (root: AnnotatedName) => (root ? toElementLine(root) : null),
  ocl: (root: OclValue) => [...root.parts],
};

/**
 * A condition with its prefix (`assertion trigger ctx = 1`): the prefix as
 * the catalog writes it (spaces between its words aside), or null.
 */
export const parseCondition = (
  text: string,
): Parsed<{ prefix: AssertionPrefix | null; tree: AssertionTree | null }> => {
  const { root, errors } = parse<AssertionValue>('assertion', text);
  const prefix = root.prefix
    ? (root.prefix.replace(/[ \t]+/, ' ') as AssertionPrefix)
    : null;
  return { value: { prefix, tree: toAssertionTree(root.expr) }, errors };
};

/** One value of a predefined type on its own (an inspector field). Empty is valid. */
export const parseValue = <T extends ValueType>(
  type: T,
  text: string,
): Parsed<ValueData[T]> => {
  const { root, errors } = parse<never>(type, text);
  return { value: READ[type](root), errors };
};

/**
 * An `enumSet` value's options, in the order written (goal-controller#162):
 * empty when it is unset, null when it isn't a list. An engine reads a set
 * with it, never splitting the text itself.
 */
export const readEnumSet = (text: string): string[] | null => {
  const read = parseValue('enumSet', text);
  return read.errors.length ? null : read.value;
};

/** Options as an `enumSet` value writes them: comma-separated. */
export const enumSetText = (values: readonly string[]): string =>
  values.join(', ');

/**
 * The tree of an `expression` value, as checks and engines read it (they
 * never parse a formula's text themselves). Null when it is empty or isn't an
 * expression.
 */
export const readExpression = (text: string): ExpressionTree | null => {
  const read = parseValue('expression', text);
  return read.errors.length ? null : read.value;
};

/**
 * The tree of an `assertion` value (its prefix aside) with every comparison's
 * sides as expressions (`x > 3` too: a `var` and a `number`). Null when it is
 * empty or isn't an assertion.
 */
export const readAssertion = (text: string): AssertionReading | null => {
  const { root, errors } = parse<AssertionValue>('assertion', text);
  return errors.length ? null : toAssertionReading(root.expr);
};

/** An expression's nodes, each before its operands (a check or an engine walks them). */
export const expressionNodes = (tree: ExpressionTree): ExpressionTree[] => {
  switch (tree.kind) {
    case 'call':
      return [tree, ...tree.args.flatMap(expressionNodes)];
    case 'binary':
      return [
        tree,
        ...expressionNodes(tree.left),
        ...expressionNodes(tree.right),
      ];
    case 'unary':
      return [tree, ...expressionNodes(tree.expr)];
    default:
      return [tree];
  }
};

/** An assertion's comparisons of expressions and its calls, in the order written. */
export const comparisonsOf = (
  tree: AssertionTree | null,
): (ExpressionComparison | Extract<AssertionTree, { kind: 'call' }>)[] => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return [...comparisonsOf(tree.left), ...comparisonsOf(tree.right)];
    case 'not':
    case 'paren':
      return comparisonsOf(tree.expr);
    case 'comparison':
    case 'call':
      return [tree];
    default:
      return [];
  }
};

/** The expressions an assertion's comparisons and calls hold (each side; a call whole). */
export const assertionExpressions = (
  tree: AssertionTree | null,
): ExpressionTree[] =>
  comparisonsOf(tree).flatMap((atom) =>
    atom.kind === 'call' ? [atom] : [atom.left, atom.right],
  );

/**
 * Every member an assertion reads (`room.clean`, `tank.level < 3`,
 * `room.clean = true`, goal-controller#135), in the order written: what a
 * check or an engine reads of them, never splitting the text.
 */
export const assertionMembers = (
  tree: AssertionTree | AssertionReading | null,
): { ref: string; member: string }[] => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return [...assertionMembers(tree.left), ...assertionMembers(tree.right)];
    case 'not':
    case 'paren':
      return assertionMembers(tree.expr);
    case 'member':
      return [{ ref: tree.ref, member: tree.member }];
    case 'assign':
      return tree.member ? [{ ref: tree.variable, member: tree.member }] : [];
    case 'comparison':
    case 'call':
      return assertionExpressions(tree)
        .flatMap(expressionNodes)
        .flatMap((node) =>
          node.kind === 'member'
            ? [{ ref: node.ref, member: node.member }]
            : [],
        );
    default:
      return [];
  }
};

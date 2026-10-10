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
import { ID_PREFIXES, type ValueType } from './catalog.js';
import type {
  AnnotatedName,
  Annotation,
  AssertExpr,
  AssertionValue,
  BoolValue,
  Cost,
  Declaration,
  Document,
  ElementLine,
  EnumValue,
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

/** An assertion (AssertionRegex.g4's alternatives). */
export type AssertionTree =
  | {
      kind: 'and' | 'or';
      left: AssertionTree | null;
      right: AssertionTree | null;
    }
  | { kind: 'not'; expr: AssertionTree | null }
  | { kind: 'paren'; expr: AssertionTree | null }
  /** `x = true`; `negated`: `x != true` (CtxRegex.g4's, where a value allows it) */
  | { kind: 'assign'; variable: string; value: boolean; negated?: true }
  | { kind: 'compare'; variable: string; operator: string; value: string }
  | { kind: 'var'; variable: string }
  | { kind: 'bool'; value: boolean };

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

const parse = <T>(start: LexerStart, text: string) => {
  const result = parseWith(goalServices(), start, text);
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
 */
export const parseElementLine = (
  text: string,
): Parsed<ElementLineData | null> => {
  // RTRegex.g4 skipped tabs only
  if (/^\t*$/.test(text)) return { value: null, errors: [] };
  const { root, errors } = parse<ElementLine>('elementLine', text);
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

/** An element line's id and colon (annotations and indentation before them). */
const ELEMENT_ID = new RegExp(
  `^\\s*(?:(?:<<[^>]*>>|\\{[^}]*\\})\\s*)*(?:${[...ID_PREFIXES]
    .sort((a, b) => b.length - a.length)
    .join('|')})(?:[0-9][0-9.]*X?|X|[0-9][a-z])\\s*:`,
);
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
): { text: string; name: { from: number; to: number } | null } => {
  const id = ELEMENT_ID.exec(text);
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
  },
  text: string,
): Parsed<ElementLineData | null> => {
  const named =
    dialect.notation?.names === 'text'
      ? withWordName(text)
      : { text, name: null };
  const read = parseElementLine(
    dialect.notation?.whitespace === 'ignore'
      ? withoutBracketSpaces(named.text).text
      : named.text,
  );
  const { name } = named;
  return name && read.value
    ? {
        ...read,
        value: { ...read.value, name: text.slice(name.from, name.to) },
      }
    : read;
};

/** A document: element lines with ids and property lines, or (`ids: false`) lines without ids. */
export const parseDocument = (
  text: string,
  { ids = true }: { ids?: boolean } = {},
): Parsed<DocumentLine[]> => {
  if (!ids) {
    const { root, errors } = parse<PlainDocument>('plainDocument', text);
    return {
      value: root.lines.map((line) => ({
        kind: 'element',
        line: lineOf(line),
        ...toElementLine(line),
      })),
      errors,
    };
  }
  const { root, errors } = parse<Document>('document', text);
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

export const toAssertionTree = (
  expr: AssertExpr | undefined,
): AssertionTree | null => {
  switch (expr?.$type) {
    case 'AssertBinary':
      return {
        kind: expr.operator === '&' ? 'and' : 'or',
        left: toAssertionTree(expr.left),
        right: toAssertionTree(expr.right),
      };
    case 'AssertNot':
      return { kind: 'not', expr: toAssertionTree(expr.expr) };
    case 'AssertParen':
      return { kind: 'paren', expr: toAssertionTree(expr.expr) };
    case 'AssertAssign':
      return expr.variable && expr.value
        ? {
            kind: 'assign',
            variable: expr.variable,
            value: expr.value === 'true',
            ...(expr.operator === '!=' && { negated: true as const }),
          }
        : null;
    case 'AssertCompare':
      return expr.variable && expr.operator && expr.value
        ? {
            kind: 'compare',
            variable: expr.variable,
            operator: expr.operator,
            value: expr.value,
          }
        : null;
    case 'AssertVar':
      return expr.variable ? { kind: 'var', variable: expr.variable } : null;
    case 'AssertConst':
      return expr.value ? { kind: 'bool', value: expr.value === 'true' } : null;
    default:
      return null;
  }
};

/** What each value type reads into. */
export type ValueData = {
  assertion: AssertionTree | null;
  int: string | null;
  number: string | null;
  bool: boolean | null;
  text: string | null;
  enum: string | null;
  refList: string[];
  pairList: { name: string; value: string }[];
  annotatedName: ElementLineData | null;
  /** its tokens, as written */
  ocl: string[];
};

const READ: { [T in ValueType]: (root: never) => ValueData[T] } = {
  assertion: (root: AssertionValue) => toAssertionTree(root.expr),
  int: (root: IntValue) => root.value ?? null,
  number: (root: NumberValue) => root.value ?? null,
  bool: (root: BoolValue) => (root.value ? root.value === 'true' : null),
  text: (root: TextValue) => root.value ?? null,
  enum: (root: EnumValue) => root.value ?? null,
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

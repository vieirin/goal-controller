import type { ParseResult } from 'langium';
import type { RtOperator } from './constructs.js';
import type {
  AssertExpr,
  AssertionValue,
  Document,
  Expr,
} from './generated/ast.js';
import {
  createRtCoreServices,
  parseValue,
  type RtCoreServices,
} from './module.js';

/** Langium-free notation AST, so CommonJS consumers need no langium types. */
export type RtExpr =
  | { kind: 'ref'; id: string }
  | { kind: 'skip' }
  | { kind: 'bracket'; expr: RtExpr | null }
  | { kind: 'retry'; expr: RtExpr | null; times: string }
  | {
      kind: 'binary';
      op: RtOperator;
      left: RtExpr | null;
      right: RtExpr | null;
    };

export type ParsedNodeText = {
  /** `G1`, `T2.1`, ...; empty when the text has no id */
  id: string;
  /** the name as written, untrimmed (`' Name '` in `G1: Name [G2]`) */
  name: string;
  notation: RtExpr | null;
  /** `line:column message`, column 0-based like ANTLR's */
  errors: string[];
};

/** Langium-free assertion AST (AssertionRegex.g4's alternatives). */
export type RtAssertion =
  | { kind: 'and' | 'or'; left: RtAssertion | null; right: RtAssertion | null }
  | { kind: 'not'; expr: RtAssertion | null }
  | { kind: 'paren'; expr: RtAssertion | null }
  | { kind: 'assign'; variable: string; value: boolean }
  | { kind: 'compare'; variable: string; op: string; value: string }
  | { kind: 'var'; variable: string }
  | { kind: 'bool'; value: boolean };

let services: RtCoreServices | undefined;
const rtServices = () => (services ??= createRtCoreServices().RtNotation);

/** `line:column message`, column 0-based like ANTLR's error listener. */
const syntaxErrors = (result: ParseResult): string[] => [
  ...result.lexerErrors.map(
    (e) => `${e.line ?? 1}:${(e.column ?? 1) - 1} ${e.message}`,
  ),
  ...result.parserErrors.map(
    (e) =>
      `${Number.isNaN(e.token.startLine) ? 1 : e.token.startLine}:${
        Number.isNaN(e.token.startColumn) ? 0 : (e.token.startColumn ?? 1) - 1
      } ${e.message}`,
  ),
];

const toRtExpr = (expr: Expr | undefined): RtExpr | null => {
  // after a syntax error Langium leaves the nodes it could not finish partial
  switch (expr?.$type) {
    case 'Ref':
      return expr.ref?.$refText ? { kind: 'ref', id: expr.ref.$refText } : null;
    case 'Skip':
      return { kind: 'skip' };
    case 'Bracket':
      return { kind: 'bracket', expr: toRtExpr(expr.expr) };
    case 'RetryExpr':
      return {
        kind: 'retry',
        expr: toRtExpr(expr.expr),
        times: expr.times ?? '',
      };
    case 'BinaryExpr':
      return {
        kind: 'binary',
        op: expr.operator,
        left: toRtExpr(expr.left),
        right: toRtExpr(expr.right),
      };
    default:
      return null;
  }
};

/**
 * The text of an expression without whitespace, like ANTLR's `getText()`
 * (edgeV2 keys its retry map by it).
 */
export const exprText = (expr: RtExpr | null): string => {
  switch (expr?.kind) {
    case 'ref':
      return expr.id;
    case 'skip':
      return 'skip';
    case 'bracket':
      return `[${exprText(expr.expr)}]`;
    case 'retry':
      return `${exprText(expr.expr)}@${expr.times}`;
    case 'binary':
      return `${exprText(expr.left)}${expr.op}${exprText(expr.right)}`;
    default:
      return '';
  }
};

/**
 * Parses one goal name (`G1: Name [G2;G3]`) synchronously, without linking.
 * An empty text is valid and yields an empty id, like edgeV2's `blank` rule.
 */
export const parseNodeText = (text: string): ParsedNodeText => {
  const result = rtServices().parser.LangiumParser.parse<Document>(text);
  const errors = syntaxErrors(result);
  const lines = result.value.lines;
  // a goal name is a single line (edgeV2 has no use for NEWLINE)
  if (/[\r\n]/.test(text)) errors.push('1:0 a goal name is a single line');
  if (lines.length > 1) {
    const extra = lines[1]!.$cstNode;
    errors.push(
      `${(extra?.range.start.line ?? 0) + 1}:${
        extra?.range.start.character ?? 0
      } extraneous input after the notation`,
    );
  }
  const line = lines[0];
  // property lines and resource declarations exist only in the notation document
  if (line && line.$type !== 'NodeLine') {
    errors.push('1:0 a goal name starts with its id');
  }
  if (line?.$type === 'NodeLine' && line.resource) {
    const at = line.resource.$cstNode?.range.start.character ?? 0;
    errors.push(`1:${Math.max(0, at - 1)} token recognition error at: '{'`);
  }
  return line?.$type === 'NodeLine'
    ? {
        id: line.name ?? '',
        name: line.label ?? '',
        notation: toRtExpr(line.notation),
        errors,
      }
    : { id: '', name: '', notation: null, errors };
};

const toRtAssertion = (expr: AssertExpr | undefined): RtAssertion | null => {
  switch (expr?.$type) {
    case 'AssertBinary':
      return {
        kind: expr.operator === '&' ? 'and' : 'or',
        left: toRtAssertion(expr.left),
        right: toRtAssertion(expr.right),
      };
    case 'AssertNot':
      return { kind: 'not', expr: toRtAssertion(expr.expr) };
    case 'AssertParen':
      return { kind: 'paren', expr: toRtAssertion(expr.expr) };
    case 'AssertAssign':
      return expr.variable && expr.value
        ? {
            kind: 'assign',
            variable: expr.variable,
            value: expr.value === 'true',
          }
        : null;
    case 'AssertCompare':
      return expr.variable && expr.op && expr.value
        ? {
            kind: 'compare',
            variable: expr.variable,
            op: expr.op,
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

/**
 * Parses an `assertion`/`maintain` value (AssertionRegex.g4) synchronously.
 * An empty text is valid, like the grammar's `blank` rule.
 */
export const parseAssertion = (
  text: string,
): { expr: RtAssertion | null; errors: string[] } => {
  const result = parseValue<AssertionValue>(rtServices(), 'assertion', text);
  return {
    expr: toRtAssertion(result.value.expr),
    errors: syntaxErrors(result),
  };
};

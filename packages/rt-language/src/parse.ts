import type { LangiumParser } from 'langium';
import type { RtOperator } from './constructs.js';
import type { Document, Expr } from './generated/ast.js';
import { createRtCoreServices } from './module.js';

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

let parser: LangiumParser | undefined;

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
  parser ??= createRtCoreServices().RtNotation.parser.LangiumParser;
  const result = parser.parse<Document>(text);
  const errors = [
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
  return {
    id: line?.name ?? '',
    name: line?.label ?? '',
    notation: toRtExpr(line?.notation),
    errors,
  };
};

/**
 * The Notation view's lines, read with the goal language's parser: an element
 * line (its annotations, id, name, notation and declaration, each with where
 * it is) or a property line, one line at a time so that a line being typed
 * leaves the others readable.
 */
import { hasIds, type AnyDialect } from '@goal-controller/dialect';
import { AstUtils, GrammarUtils, type AstNode, type CstNode } from 'langium';
import type {
  AnnotatedName,
  Document,
  ElementLine,
  PlainDocument,
  RtExpr,
} from '../generated/ast.js';
import { parseWith } from '../module.js';
import {
  goalServices,
  parseElementLine,
  parseValue,
  syntaxErrorsOf,
  toRtTree,
  type GoalSyntaxError,
  type RtTree,
} from '../parse.js';
import type { DeclaredProperties } from '../print.js';

/** Where something is, in the text read (offsets). */
export type Span = { from: number; to: number };

/** An operator as written in a notation. */
export type WrittenOperator = {
  symbol: string;
  form: 'infix' | 'prefix' | 'postfix' | 'standalone';
  span: Span;
};

export type ElementReading = {
  kind: 'element';
  /** null on a line without an id */
  id: string | null;
  idSpan: Span | null;
  /** as written, trimmed */
  name: string;
  /** the element's text (its id, name and notation): from after the annotations to the declaration */
  text: string;
  textSpan: Span;
  annotations: { properties: DeclaredProperties; span: Span }[];
  notation: {
    /** as written between the brackets, trimmed */
    text: string;
    /** between the brackets */
    span: Span;
    tree: RtTree | null;
    refs: { id: string; span: Span }[];
    /** where `skip` is written */
    skips: Span[];
    operators: WrittenOperator[];
  } | null;
  declaration: { properties: DeclaredProperties; span: Span } | null;
  errors: GoalSyntaxError[];
};

export type PropertyReading = {
  kind: 'property';
  key: string;
  keySpan: Span;
  value: string;
  valueSpan: Span;
  errors: GoalSyntaxError[];
};

export type LineReading =
  | ElementReading
  | PropertyReading
  | { kind: 'blank'; errors: GoalSyntaxError[] };

const spanOf = (node: CstNode | undefined): Span | null =>
  node ? { from: node.offset, to: node.end } : null;

const propertySpan = (node: AstNode, property: string): Span | null =>
  spanOf(
    node.$cstNode && GrammarUtils.findNodeForProperty(node.$cstNode, property),
  );

const keywordSpan = (node: AstNode, keyword: string): Span | null =>
  spanOf(
    node.$cstNode && GrammarUtils.findNodeForKeyword(node.$cstNode, keyword),
  );

const operatorOf = (expr: RtExpr): WrittenOperator | null => {
  const at = (property: string) => propertySpan(expr, property);
  switch (expr.$type) {
    case 'RtBinary': {
      // an infix rule's operator is a keyword between its operands
      const node = expr.$cstNode;
      if (!node) return null;
      const after = (expr.left?.$cstNode?.end ?? node.offset) - node.offset;
      const index = node.text.indexOf(expr.operator, after);
      return index < 0
        ? null
        : {
            symbol: expr.operator,
            form: 'infix',
            span: {
              from: node.offset + index,
              to: node.offset + index + expr.operator.length,
            },
          };
    }
    case 'RtNot': {
      const span = at('operator');
      return span && { symbol: expr.operator, form: 'prefix', span };
    }
    case 'RtArgument': {
      const span = at('operator');
      return span && { symbol: expr.operator, form: 'postfix', span };
    }
    case 'RtStandalone': {
      const span = at('symbol');
      return span && { symbol: expr.symbol, form: 'standalone', span };
    }
    default:
      return null;
  }
};

const defined = (properties: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as DeclaredProperties;

const readElement = (
  line: ElementLine | AnnotatedName,
  text: string,
  errors: GoalSyntaxError[],
): ElementReading => {
  const annotations = line.annotations.flatMap((annotation) => {
    const span = spanOf(annotation.$cstNode);
    if (!span) return [];
    const properties =
      annotation.$type === 'Stereotype'
        ? defined({ stereotype: annotation.stereotype })
        : defined({ tag: annotation.tag, tagValue: annotation.tagValue });
    return [{ properties, span }];
  });
  const declarationSpan = spanOf(line.declaration?.$cstNode);
  const declaration =
    line.declaration && declarationSpan
      ? {
          properties: defined({
            type: line.declaration.type,
            lowerBound: line.declaration.lowerBound,
            upperBound: line.declaration.upperBound,
            initialValue: line.declaration.initialValue,
          }),
          span: declarationSpan,
        }
      : null;
  const annotated = annotations.at(-1)?.span.to ?? 0;
  const idSpan = line.name ? propertySpan(line, 'name') : null;
  // an id the parser recovered from further in (`[G2]`) is not the line's
  const ownId = idSpan !== null && !text.slice(annotated, idSpan.from).trim();
  const nameSpan = propertySpan(line, 'label');
  // the element's text starts at its id (or name): what is before is annotations
  const textFrom =
    (ownId ? idSpan?.from : undefined) ??
    (line.$type === 'AnnotatedName' ? nameSpan?.from : undefined) ??
    annotated;
  // (a line without an id may have one: an annotated name's is optional)
  // a declaration being typed (`{int 0..`) is not the element's text either
  const brace = text.indexOf('{', textFrom);
  const textTo = declarationSpan?.from ?? (brace >= 0 ? brace : text.length);
  const written = text.slice(textFrom, textTo);
  const textSpan = {
    from: textFrom + (written.length - written.trimStart().length),
    to: textTo - (written.length - written.trimEnd().length),
  };
  const open = keywordSpan(line, '[');
  const close = line.notation ? keywordSpan(line, ']') : null;
  const notationSpan =
    open && line.notation
      ? {
          from: open.to,
          to:
            close && close.from > open.to
              ? close.from
              : (spanOf(line.notation.$cstNode)?.to ?? open.to),
        }
      : null;
  const exprs = line.notation
    ? [line.notation, ...AstUtils.streamAllContents(line.notation)]
    : [];
  const id = ownId ? (line.name ?? null) : null;
  return {
    kind: 'element',
    id,
    idSpan: id === null ? null : idSpan,
    name: (line.label ?? '').trim(),
    text: text.slice(textSpan.from, textSpan.to),
    textSpan,
    annotations,
    notation:
      notationSpan && line.notation
        ? {
            text: text.slice(notationSpan.from, notationSpan.to).trim(),
            span: notationSpan,
            tree: toRtTree(line.notation),
            refs: exprs.flatMap((node) => {
              const expr = node as RtExpr;
              if (expr.$type !== 'RtRef') return [];
              const span = spanOf(expr.$cstNode);
              return span && expr.ref.$refText
                ? [{ id: expr.ref.$refText, span }]
                : [];
            }),
            skips: exprs.flatMap((node) => {
              const span =
                (node as RtExpr).$type === 'RtSkip' && spanOf(node.$cstNode);
              return span ? [span] : [];
            }),
            operators: exprs.flatMap((expr) => {
              const op = operatorOf(expr as RtExpr);
              return op ? [op] : [];
            }),
          }
        : null,
    declaration,
    errors,
  };
};

/**
 * What a line's annotations set: the first stereotype and the first tagged
 * value it has (a repeated one is not read).
 */
export const annotatedProperties = (
  read: Pick<ElementReading, 'annotations'>,
): DeclaredProperties => {
  const properties: DeclaredProperties = {};
  const seen = new Set<string>();
  for (const { properties: set } of read.annotations) {
    const kind = 'stereotype' in set ? 'stereotype' : 'tag';
    if (seen.has(kind)) continue;
    seen.add(kind);
    Object.assign(properties, set);
  }
  return properties;
};

/**
 * One line of a Notation view document, as the goal language reads it (a
 * definition whose lines have no ids reads annotated names).
 */
export const readLine = (
  definition: Pick<AnyDialect, 'elements'>,
  text: string,
): LineReading => {
  const ids = hasIds(definition);
  const result = parseWith(
    goalServices(),
    ids ? 'document' : 'plainDocument',
    text,
  );
  const errors = syntaxErrorsOf(result, text.length);
  const root = result.value as Document | PlainDocument;
  const [line] = root.lines;
  if (!line) return { kind: 'blank', errors };
  if (line.$type === 'PropertyLine') {
    const keySpan = propertySpan(line, 'key') ?? { from: 0, to: 0 };
    const valueSpan = propertySpan(line, 'value') ?? {
      from: keySpan.to,
      to: keySpan.to,
    };
    return {
      kind: 'property',
      key: line.key,
      keySpan,
      value: line.value ?? '',
      valueSpan,
      errors,
    };
  }
  return readElement(line, text, errors);
};

/** The id a line starts with (indentation and annotations aside), if it is an element line with one. */
export const lineId = (
  definition: Pick<AnyDialect, 'elements'>,
  text: string,
): string | null => {
  const read = readLine(definition, text);
  return read.kind === 'element' ? read.id : null;
};

/**
 * A property line's key and value, if the line is one with a key the
 * definition writes on property lines (indentation ignored).
 */
export const readPropertyLine = (
  definition: Pick<AnyDialect, 'elements' | 'propertyLineOrder'>,
  text: string,
): { key: string; value: string } | null => {
  const read = readLine(definition, text);
  return read.kind === 'property' &&
    !read.errors.length &&
    definition.propertyLineOrder.includes(read.key)
    ? { key: read.key, value: read.value }
    : null;
};

/**
 * Whether a name may be written on a kind's line as it is (an unknown kind:
 * any): a line with an id reads letters, spaces, `-` and `'` (RTRegex.g4's
 * WORD); one without, anything on one line but brackets and braces.
 */
export const isValidName = (
  definition: Pick<AnyDialect, 'elements'>,
  kind: string,
  name: string,
): boolean => {
  const element = (definition.elements as AnyDialect['elements'])[kind];
  if (!element || name === '') return true;
  if (element.prefix !== undefined) {
    const read = parseElementLine(`${element.prefix}1:${name}`);
    return !read.errors.length && read.value?.name === name;
  }
  // a name may start with an id (`G1: Deliver`), the element's own
  const read = parseValue('annotatedName', name);
  return (
    !read.errors.length &&
    !!read.value &&
    !read.value.annotations.length &&
    !read.value.notation &&
    !read.value.declaration
  );
};

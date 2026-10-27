/**
 * The Notation view's lines, read with the goal language's parser: an element
 * line (its annotations, id, name, notation and declaration, each with where
 * it is) or a property line, one line at a time so that a line being typed
 * leaves the others readable.
 */
import {
  ACTOR_LINE_KEY,
  LINK_LINE_KEY,
  hasIds,
  type AnyDialect,
} from '@goal-controller/dialect';
import { AstUtils, GrammarUtils, type AstNode, type CstNode } from 'langium';
import type {
  AnnotatedName,
  Document,
  ElementLine,
  PlainDocument,
  RtExpr,
} from '../generated/ast.js';
import {
  idPrefixesOf,
  INFIX_SYMBOLS,
  propertyKeysOf,
  STANDALONE_SYMBOLS,
} from '../catalog.js';
import { parseWith } from '../module.js';
import {
  goalServices,
  parseElementLine,
  parseValue,
  propertyKeyText,
  syntaxErrorsOf,
  toRtTree,
  withoutBracketSpaces,
  nameReading,
  withWordName,
  type GoalSyntaxError,
  type RtTree,
} from '../parse.js';
import { unquotedName, type DeclaredProperties } from '../print.js';
import { isPlainActorLine, isPlainLinkLine } from './linkLine.js';

/** Where something is, in the text read (offsets). */
export type Span = { from: number; to: number };

/** An operator as written in a notation. */
export type WrittenOperator = {
  symbol: string;
  form: 'infix' | 'prefix' | 'postfix' | 'standalone' | 'call';
  span: Span;
  /** a call's operands, as written */
  operands?: number;
};

/**
 * Two binary operators written at the same nesting level, with no bracket
 * of its own between them (`G13#G14;G12`): `first` and `second` as written,
 * left to right; `span` is `second`'s, where the model mentions it.
 */
export type MixedOperators = { span: Span; first: string; second: string };

export type ElementReading = {
  kind: 'element';
  /** null on a line without an id */
  id: string | null;
  idSpan: Span | null;
  /** as written, trimmed; a quoted one (`writtenName`), without its quotes */
  name: string;
  /** the element's text (its id, name and notation): from after the annotations to the declaration, its name unquoted */
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
    mixed: MixedOperators[];
    /** every `[...]`/`(...)` group's span, wherever it is (`notation.grouping: false`'s check) */
    groups: Span[];
  } | null;
  /** its bracket when it holds a cost (`[W = 0.1x]`), not a notation */
  cost: {
    value: string | null;
    variable: string | null;
    /** between the brackets */
    span: Span;
  } | null;
  declaration: { properties: DeclaredProperties; span: Span } | null;
  errors: GoalSyntaxError[];
};

export type PropertyReading = {
  kind: 'property';
  /** as stored: a property's own (`Probability`), or a keyed key (`Probability[e1]`) */
  key: string;
  keySpan: Span;
  /** a keyed key's parts (goal-controller#354): the property's key, and the name in its brackets */
  keyed?: { key: string; name: string; nameSpan: Span };
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
    case 'RtComma':
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
    case 'RtCall': {
      const span = at('function');
      return (
        span && {
          symbol: expr.function,
          form: 'call',
          span,
          operands: expr.args.length,
        }
      );
    }
    default:
      return null;
  }
};

// a precedence-climbed infix node's $cstNode is the whole activation it was
// climbed in (Langium reuses it while building), so only the node a fresh
// climb starts from (the notation, a group's or a call argument's) has its
// own true span; `scanOperators` reads the rest from its text, not its tree.
const INFIX_BY_LENGTH = [...INFIX_SYMBOLS].sort((a, b) => b.length - a.length);
// written the same as a standalone symbol (`[+]`'s `+`): only an operator
// where an operand ends just before it, else it is one on its own
const AMBIGUOUS = new Set(STANDALONE_SYMBOLS as readonly string[]);
const OPERAND_END = /[A-Za-z0-9\])]/;

/** Every binary operator `scanOperators` reads in one text, left to right, skipping `[...]` and `(...)`. */
const scanOperators = (
  text: string,
  offset: number,
): { span: Span; symbol: string }[] => {
  const found: { span: Span; symbol: string }[] = [];
  let depth = 0;
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '[' || ch === '(') {
      depth++;
      i++;
      continue;
    }
    if (ch === ']' || ch === ')') {
      depth = Math.max(depth - 1, 0);
      i++;
      continue;
    }
    const symbol =
      depth === 0
        ? INFIX_BY_LENGTH.find((s) => text.startsWith(s, i))
        : undefined;
    if (
      symbol &&
      (!AMBIGUOUS.has(symbol) || OPERAND_END.test(text[i - 1] ?? ''))
    ) {
      found.push({
        span: { from: offset + i, to: offset + i + symbol.length },
        symbol,
      });
      i += symbol.length;
      continue;
    }
    i++;
  }
  return found;
};

/**
 * Where a notation mixes two different binary operators (the catalog's `,`
 * included) at one nesting level without a bracket of its own
 * (`G13#G14;G12`, not `[G13#G14];G12`): adjacent operators of one level,
 * left to right, that are not the same. A group, a call's parentheses, `!`
 * and `@n` each start a fresh level, so a mix inside one of those is found
 * on its own.
 */
const mixedOperators = (expr: RtExpr): MixedOperators[] => {
  const found: MixedOperators[] = [];
  // where a fresh level starts: the notation itself, under a group or a
  // call's parentheses (its own `$cstNode` is this level's, not shared)
  const enter = (node: RtExpr | undefined): void => {
    if (!node) return;
    switch (node.$type) {
      case 'RtComma':
      case 'RtBinary': {
        const cst = node.$cstNode;
        if (cst) {
          const ops = scanOperators(cst.text, cst.offset);
          for (let i = 1; i < ops.length; i++) {
            if (ops[i]!.symbol !== ops[i - 1]!.symbol)
              found.push({
                span: ops[i]!.span,
                first: ops[i - 1]!.symbol,
                second: ops[i]!.symbol,
              });
          }
        }
        nested(node.left);
        nested(node.right);
        return;
      }
      case 'RtGroup':
        enter(node.expr);
        return;
      case 'RtNot':
      case 'RtArgument':
        enter(node.expr);
        return;
      case 'RtCall':
        node.args.forEach(enter);
        return;
      default:
        return;
    }
  };
  // within one level, where a nested level starts: a group or a call
  // (an operator or a modifier is this level's still, read through)
  const nested = (node: RtExpr | undefined): void => {
    if (!node) return;
    switch (node.$type) {
      case 'RtComma':
      case 'RtBinary':
        nested(node.left);
        nested(node.right);
        return;
      case 'RtNot':
      case 'RtArgument':
        nested(node.expr);
        return;
      case 'RtGroup':
      case 'RtCall':
        enter(node);
        return;
      default:
        return;
    }
  };
  enter(expr);
  return found;
};

/** Every `[...]`/`(...)` group's span in a notation, wherever it is (`RtGroup`'s own span is never the shared, climbed one). */
const groupSpans = (expr: RtExpr | undefined): Span[] => {
  if (!expr) return [];
  switch (expr.$type) {
    case 'RtGroup':
      return [
        ...(spanOf(expr.$cstNode) ? [spanOf(expr.$cstNode)!] : []),
        ...groupSpans(expr.expr),
      ];
    case 'RtComma':
    case 'RtBinary':
      return [...groupSpans(expr.left), ...groupSpans(expr.right)];
    case 'RtNot':
    case 'RtArgument':
      return groupSpans(expr.expr);
    case 'RtCall':
      return expr.args.flatMap(groupSpans);
    default:
      return [];
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
  const cost = line.$type === 'ElementLine' ? line.cost : undefined;
  const bracketed = line.notation ?? cost;
  const close = bracketed ? keywordSpan(line, ']') : null;
  const bracketSpan =
    open && bracketed
      ? {
          from: open.to,
          to:
            close && close.from > open.to
              ? close.from
              : (spanOf(bracketed.$cstNode)?.to ?? open.to),
        }
      : null;
  const notationSpan = line.notation ? bracketSpan : null;
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
            mixed: mixedOperators(line.notation),
            groups: groupSpans(line.notation),
          }
        : null,
    cost:
      cost && bracketSpan
        ? {
            value: cost.value ?? null,
            variable: cost.variable ?? null,
            span: bracketSpan,
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

/** A reading of a line without its bracket's spaces, its spans in the line as written. */
const writtenAs = (
  read: ElementReading,
  text: string,
  origin: (offset: number) => number,
): ElementReading => {
  const span = ({ from, to }: Span): Span => ({
    from: origin(from),
    // the end of the last character read, not where the next one starts
    to: to > from ? origin(to - 1) + 1 : origin(from),
  });
  const textSpan = span(read.textSpan);
  const notationSpan = read.notation && span(read.notation.span);
  return {
    ...read,
    idSpan: read.idSpan && span(read.idSpan),
    text: text.slice(textSpan.from, textSpan.to),
    textSpan,
    annotations: read.annotations.map((a) => ({ ...a, span: span(a.span) })),
    notation: read.notation &&
      notationSpan && {
        ...read.notation,
        text: text.slice(notationSpan.from, notationSpan.to).trim(),
        span: notationSpan,
        refs: read.notation.refs.map((ref) => ({
          ...ref,
          span: span(ref.span),
        })),
        skips: read.notation.skips.map(span),
        operators: read.notation.operators.map((op) => ({
          ...op,
          span: span(op.span),
        })),
        mixed: read.notation.mixed.map((m) => ({ ...m, span: span(m.span) })),
        groups: read.notation.groups.map(span),
      },
    cost: read.cost && { ...read.cost, span: span(read.cost.span) },
    declaration: read.declaration && {
      ...read.declaration,
      span: span(read.declaration.span),
    },
    errors: read.errors.map((error) => {
      const at = span({ from: error.offset, to: error.offset + error.length });
      return {
        ...error,
        offset: at.from,
        column: at.from,
        length: at.to - at.from,
      };
    }),
  };
};

/**
 * One line of a Notation view document, as the goal language reads it (a
 * definition whose lines have no ids reads annotated names; one that ignores
 * the spaces in brackets reads the line without them, its spans in the line
 * as written; one whose names are free text, `nameReading`, reads them so).
 * `wordNames`: its names read as RTRegex.g4's WORD, whatever its dialect's.
 */
export const readLine = (
  definition: Pick<AnyDialect, 'elements'> &
    Partial<
      Pick<
        AnyDialect,
        | 'framework'
        | 'notation'
        | 'links'
        | 'linkLines'
        | 'actors'
        | 'propertyLineOrder'
      >
    >,
  text: string,
  wordNames = false,
): LineReading => {
  // a document without ids: its link and actor lines (quoted), read here;
  // its property lines start with a declared key, which GoalLexer reads
  const plainKey = isPlainLinkLine(definition, text)
    ? LINK_LINE_KEY
    : isPlainActorLine(definition, text)
      ? ACTOR_LINE_KEY
      : null;
  if (plainKey) {
    const from = text.length - text.trimStart().length;
    const keySpan = { from, to: from + plainKey.length };
    const valueFrom = text.length - text.slice(keySpan.to).trimStart().length;
    const value = text.slice(valueFrom).trimEnd();
    return {
      kind: 'property',
      key: plainKey,
      keySpan,
      value,
      valueSpan: { from: valueFrom, to: valueFrom + value.length },
      errors: [],
    };
  }
  const reading = wordNames ? null : nameReading(definition);
  if (reading) {
    // a free-text name, read as a WORD of the same length: then its text as written
    const named = withWordName(text, idPrefixesOf(definition), {
      brackets: reading === 'text',
    });
    if (named.name && named.text !== text) {
      const read = readLine(definition, named.text, true);
      if (read.kind !== 'element') return readLine(definition, text, true);
      return {
        ...read,
        name: text.slice(named.name.from, named.name.to).trim(),
        text: text.slice(read.textSpan.from, read.textSpan.to),
      };
    }
  }
  if (definition.notation?.whitespace === 'ignore') {
    const stripped = withoutBracketSpaces(text);
    if (stripped.text !== text) {
      const read = readLine(
        {
          elements: definition.elements,
          propertyLineOrder: definition.propertyLineOrder,
        },
        stripped.text,
      );
      return read.kind === 'element'
        ? writtenAs(read, text, stripped.origin)
        : readLine(
            {
              elements: definition.elements,
              propertyLineOrder: definition.propertyLineOrder,
            },
            text,
          );
    }
  }
  const ids = hasIds(definition);
  const keys = propertyKeysOf(definition);
  const result = parseWith(
    goalServices(),
    ids ? 'document' : 'plainDocument',
    text,
    idPrefixesOf(definition),
    keys,
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
    const nameSpan = line.key && propertySpan(line.key, 'name');
    return {
      kind: 'property',
      key: propertyKeyText(line.key),
      keySpan,
      ...(line.key?.name !== undefined &&
        nameSpan && {
          keyed: { key: line.key.key, name: line.key.name, nameSpan },
        }),
      value: line.value ?? '',
      valueSpan,
      errors,
    };
  }
  const read = readElement(line, text, errors);
  // a quoted name (`"type achieve"`, `writtenName`) is the name in the quotes
  const name = keys.length ? unquotedName(read.name) : null;
  if (name === null) return read;
  const at = read.text.indexOf(read.name);
  return {
    ...read,
    name,
    text:
      read.text.slice(0, at) + name + read.text.slice(at + read.name.length),
  };
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
    const read = parseElementLine(
      `${element.prefix}1:${name}`,
      idPrefixesOf(definition),
    );
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

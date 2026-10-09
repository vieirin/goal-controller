/**
 * What an editor shows at a position of a Notation view document, from the
 * dialect and the model's context: a hover (an operator's construct, a
 * property's help, an element, a resource's declaration) and the definition
 * an id or a name leads to (its element line). Text in, offsets out: the
 * local support and the language server both use them.
 */
import {
  propertyOf,
  type AnyDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { isEnabled } from './reading.js';
import { readLine, type ElementReading, type Span } from './lines.js';

type Definition = Pick<
  AnyDialect,
  'name' | 'elements' | 'notation' | 'properties' | 'propertyLineOrder'
>;

export type Hover = Span & { markdown: string };

type Line = { from: number; text: string };

const linesOf = (doc: string): Line[] => {
  let from = 0;
  return doc.split('\n').map((text) => {
    const line = { from, text };
    from += text.length + 1;
    return line;
  });
};

const lineAt = (lines: Line[], pos: number): Line | undefined =>
  lines.find((line) => pos >= line.from && pos <= line.from + line.text.length);

const within = (span: Span | null | undefined, at: number) =>
  !!span && at >= span.from && at <= span.to;

/** The word (an identifier, an id) around a position of a line. */
const wordAt = (text: string, at: number): Span | null => {
  const word = /[A-Za-z0-9_.]/;
  let from = at;
  let to = at;
  while (from > 0 && word.test(text[from - 1]!)) from--;
  while (to < text.length && word.test(text[to]!)) to++;
  return to > from ? { from, to } : null;
};

/** Each element line of a document, read, with where it is. */
const elementLines = (
  definition: Definition,
  lines: Line[],
): { line: Line; read: ElementReading }[] =>
  lines.flatMap((line) => {
    const read = readLine(definition, line.text);
    return read.kind === 'element' ? [{ line, read }] : [];
  });

/** The element line an id or a name (a resource an assertion names) leads to. */
const lineNamed = (definition: Definition, lines: Line[], name: string) =>
  elementLines(definition, lines).find(
    ({ read }) => read.id === name || read.name === name,
  );

/** The element line above a position (a property line's owner). */
const ownerAbove = (definition: Definition, lines: Line[], line: Line) => {
  const index = lines.indexOf(line);
  for (let i = index; i >= 0; i--) {
    const read = readLine(definition, lines[i]!.text);
    if (read.kind === 'element') return read;
  }
  return undefined;
};

const operatorHover = (
  definition: Definition,
  symbol: string,
  form: 'infix' | 'prefix' | 'postfix' | 'standalone' | 'call',
): string => {
  const notation = definition.notation;
  if (!notation || !isEnabled({ notation }, symbol, form))
    return form === 'standalone'
      ? `A standalone \`${symbol}\` is not a construct of ${definition.name}`
      : `\`${symbol}\` is not an operator of ${definition.name}`;
  const name =
    form === 'standalone'
      ? notation.standalone![symbol]!
      : notation.operators[symbol]!;
  const modifier = notation.modifiers?.[name];
  if (modifier) return `**${modifier.label}** \`${symbol}\`: ${modifier.help}`;
  const construct = notation.constructs[name]!;
  return `**${construct.label}** \`${symbol}\`: ${construct.help}`;
};

/** An element as a hover says it: `G2: Reach lab` (a goal of this model). */
const elementHover = (
  definition: Definition,
  lines: Line[],
  id: string,
  context: DefinitionContext,
): string => {
  const line = lineNamed(definition, lines, id);
  const kind = context.elements[id]?.kind;
  const declaration = line?.read.declaration
    ? ` \`${line.line.text.slice(line.read.declaration.span.from, line.read.declaration.span.to)}\``
    : '';
  return `**${id}**${line ? `: ${line.read.name}` : ''}${declaration}${kind ? ` (a ${kind} of this model)` : ''}`;
};

/** The hover at a position of a document, if anything there is explained. */
export const hoverAt = (
  definition: Definition,
  doc: string,
  pos: number,
  context: DefinitionContext,
): Hover | null => {
  const lines = linesOf(doc);
  const line = lineAt(lines, pos);
  if (!line) return null;
  const at = pos - line.from;
  const shift = (span: Span, markdown: string): Hover => ({
    from: line.from + span.from,
    to: line.from + span.to,
    markdown,
  });
  const read = readLine(definition, line.text);
  if (read.kind === 'element') {
    // an operator under the cursor (not just before it), else an id at or before it
    for (const op of read.notation?.operators ?? [])
      if (at >= op.span.from && at < op.span.to)
        return shift(op.span, operatorHover(definition, op.symbol, op.form));
    for (const ref of read.notation?.refs ?? [])
      if (within(ref.span, at))
        return shift(
          ref.span,
          elementHover(definition, lines, ref.id, context),
        );
    if (read.id && within(read.idSpan, at)) {
      const construct = context.elements[read.id]?.construct;
      const found = construct && definition.notation?.constructs[construct];
      return shift(
        read.idSpan!,
        `**${read.id}**: ${read.name}${found ? `, ${found.label}: ${found.help}` : ''}`,
      );
    }
    return null;
  }
  if (read.kind === 'property') {
    const owner = ownerAbove(definition, lines, line);
    const kind = owner?.id ? context.elements[owner.id]?.kind : undefined;
    const property =
      (kind && propertyOf(definition, kind, read.key)) ??
      Object.values(definition.properties)
        .flatMap((list) => list ?? [])
        .find((p) => p.key === read.key);
    if (within(read.keySpan, at))
      return property
        ? shift(read.keySpan, `**${read.key}**: ${property.help}`)
        : null;
    // an engine-owned server explains the value
    if (property && property.servedBy === 'engine') return null;
    // a name in the value: an element (a resource an assertion compares), a variable
    const word = wordAt(line.text, at);
    if (!word) return null;
    const name = line.text.slice(word.from, word.to);
    const target = lineNamed(definition, lines, name);
    if (target)
      return shift(
        word,
        elementHover(definition, lines, target.read.id ?? name, context),
      );
    if (context.variables.includes(name))
      return shift(word, `**${name}**: a workbench variable`);
  }
  return null;
};

/**
 * Where an id or a name at a position leads: the element line it names (an
 * id in a notation or a list, a resource or element an assertion names), as
 * the span of that line's id (or name).
 */
export const definitionAt = (
  definition: Definition,
  doc: string,
  pos: number,
): Span | null => {
  const lines = linesOf(doc);
  const line = lineAt(lines, pos);
  if (!line) return null;
  const at = pos - line.from;
  const read = readLine(definition, line.text);
  const name =
    read.kind === 'element'
      ? read.notation?.refs.find((ref) => within(ref.span, at))?.id
      : read.kind === 'property' && !within(read.keySpan, at)
        ? (() => {
            const word = wordAt(line.text, at);
            return word ? line.text.slice(word.from, word.to) : undefined;
          })()
        : undefined;
  if (!name) return null;
  const target = lineNamed(definition, lines, name);
  if (!target) return null;
  const span = target.read.idSpan ?? target.read.textSpan;
  return { from: target.line.from + span.from, to: target.line.from + span.to };
};

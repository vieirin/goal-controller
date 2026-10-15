/**
 * What an editor shows at a position of a Notation view document, from the
 * dialect and the model's context: a hover (an operator's construct, a
 * property's help, an element, a resource's declaration) and the definition
 * an id or a name leads to (its element line). Text in, offsets out: the
 * local support and the language server both use them.
 */
import {
  actorPropertiesOf,
  linkLinesOf,
  linkPropertiesOf,
  propertyOf,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
  type ValueConfig,
} from '@goal-controller/dialect';
import { highlightValue } from './highlight.js';
import { ACTOR_LINE_KEY, actorNames, readActorLine } from './actorLine.js';
import { ownerOf } from './completion.js';
import {
  LINK_LINE_KEY,
  linkOfLine,
  readLinkLine,
  targetKey,
} from './linkLine.js';
import { isEnabled } from './reading.js';
import {
  argumentsText,
  MEMBER_REF,
  membersOf,
  memberTypeText,
} from './values.js';
import { readLine, type ElementReading, type Span } from './lines.js';

type Definition = Pick<
  AnyDialect,
  'name' | 'elements' | 'notation' | 'properties' | 'propertyLineOrder'
> &
  Partial<Pick<AnyDialect, 'links' | 'linkLines' | 'actors'>>;

/**
 * A key's hover on a link or an actor line (goal-controller#109): its help,
 * as the kind of the link (or actor) the line names declares it. Null: not
 * such a line, or not on one of its keys.
 */
const ownLineHover = (
  definition: Definition,
  lines: Line[],
  line: Line,
  read: { key: string; keySpan: Span; value: string; valueSpan: Span },
  at: number,
  context: DefinitionContext,
): { span: Span; markdown: string } | null => {
  const isLink = linkLinesOf(definition) && read.key === LINK_LINE_KEY;
  const isActor = !!definition.actors && read.key === ACTOR_LINE_KEY;
  if (!isLink && !isActor) return null;
  if (within(read.keySpan, at))
    return {
      span: read.keySpan,
      markdown: isLink
        ? `**${LINK_LINE_KEY}**: a link's properties, under its source: its target, then \`{key = value}\` each`
        : `**${ACTOR_LINE_KEY}**: an actor's properties: its name in quotes, then \`{key = value}\` each`,
    };
  const reading = isLink ? readLinkLine(read.value) : readActorLine(read.value);
  if (!('value' in reading)) return null;
  const offset = at - read.valueSpan.from;
  const property = reading.value.properties.find((p) =>
    within(p.keySpan, offset),
  );
  if (!property) return null;
  let kind: string | undefined;
  if (isActor) {
    const named = targetKey(
      actorNames(
        Object.entries(context.actors ?? {}).map(([iStarId, { name }]) => ({
          iStarId,
          name,
        })),
      ),
      reading.value.target,
      'actor',
    );
    kind = 'key' in named ? context.actors?.[named.key]?.kind : undefined;
  } else {
    const source = ownerOf(
      definition,
      lines.map((l) => l.text),
      lines.indexOf(line),
      context,
    );
    const named = targetKey(context.names, reading.value.target);
    const found =
      source && 'key' in named
        ? linkOfLine(
            definition,
            Object.values(context.links ?? {}),
            source,
            named.key,
          )
        : [];
    kind = found.length === 1 ? found[0]!.kind : undefined;
  }
  // the line names no link (or actor) yet: the key as any kind declares it
  const declared = kind
    ? isLink
      ? linkPropertiesOf(definition, kind)
      : actorPropertiesOf(definition, kind)
    : isLink
      ? Object.values(definition.links ?? {}).flat()
      : (definition.actors ?? []);
  const help = declared.find((p) => p.key === property.key)?.help;
  if (!help) return null;
  return {
    span: {
      from: read.valueSpan.from + property.keySpan.from,
      to: read.valueSpan.from + property.keySpan.to,
    },
    markdown: `**${property.key}**: ${help}`,
  };
};

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
  const element = context.elements[id];
  const kind = element?.kind;
  const declaration = line?.read.declaration
    ? ` \`${line.line.text.slice(line.read.declaration.span.from, line.read.declaration.span.to)}\``
    : '';
  // an element without a line (a kind the dialect doesn't list): its name in the model
  const name = line ? line.read.name : element?.name;
  return `**${id}**${name ? `: ${name}` : ''}${declaration}${kind ? ` (a ${kind} of this model)` : ''}`;
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
    const own = ownLineHover(definition, lines, line, read, at, context);
    if (own) return shift(own.span, own.markdown);
    if (
      (linkLinesOf(definition) && read.key === LINK_LINE_KEY) ||
      (definition.actors && read.key === ACTOR_LINE_KEY)
    )
      return null;
    // its element: by id, or (without ids) by position
    const owner = ownerOf(
      definition,
      lines.map((l) => l.text),
      lines.indexOf(line),
      context,
    );
    const kind = owner ? context.elements[owner]?.kind : undefined;
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
    // a member (`room.clean`): its declared type, in the value's config
    const dotted = /^(.+)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(name);
    const config =
      property && kind && owner?.id
        ? valueOf(property, context.elements[owner.id]?.properties ?? {})
        : undefined;
    const member =
      dotted && config && !lineNamed(definition, lines, name)
        ? memberHover(config, context, dotted[1]!, dotted[2]!)
        : null;
    if (member) return shift(word, member);
    const target = lineNamed(definition, lines, name);
    if (target)
      return shift(
        word,
        elementHover(definition, lines, target.read.id ?? name, context),
      );
    // an element no line lists (an extension's kind, goal-controller#132)
    if (Object.hasOwn(context.elements, name))
      return shift(word, elementHover(definition, lines, name, context));
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

/** A member's hover: `**room.clean**: a bool, a member of room` (goal-controller#135). */
const memberHover = (
  value: ValueConfig,
  context: DefinitionContext,
  ref: string,
  member: string,
): string | null => {
  if (value.type !== 'assertion' && value.type !== 'expression') return null;
  const type = membersOf(context, ref, value.members)?.get(member);
  return `**${ref}.${member}**: ${type ? memberTypeText(type) : 'a member'}, a member of ${ref}`;
};

/** An element a field names, by its id or its name (an assertion compares a resource by name). */
const elementNamed = (context: DefinitionContext, name: string) => {
  const found =
    name in context.elements
      ? ([name, context.elements[name]!] as const)
      : Object.entries(context.elements).find(
          ([, element]) => element.name === name,
        );
  return found && { key: found[0], ...found[1] };
};

/**
 * The hover at a position of a field's value: an element it names (its id
 * and name: `**G2**: Reach lab (a goal of this model)`), a variable, or a
 * function its value type declares.
 */
export const fieldHoverAt = (
  value: ValueConfig,
  text: string,
  pos: number,
  context: DefinitionContext,
): Hover | null => {
  const span = highlightValue(value, text).find(
    (h) =>
      pos >= h.from &&
      pos <= h.to &&
      ['labelName', 'variableName', 'keyword'].includes(h.style),
  );
  if (!span) return null;
  const name = text.slice(span.from, span.to);
  const hover = (markdown: string): Hover => ({
    from: span.from,
    to: span.to,
    markdown,
  });
  const functions =
    value.type === 'expression' || value.type === 'assertion'
      ? (value.functions ?? [])
      : [];
  if (span.style === 'keyword') {
    const declared = functions.find((f) => f.name === name);
    return declared
      ? hover(`**${name}**: a function of ${argumentsText(declared.arity)}`)
      : null;
  }
  // a member (`room.clean`, goal-controller#135): its declared type
  const dotted = new RegExp(`(${MEMBER_REF})\\s*\\.\\s*$`).exec(
    text.slice(0, span.from),
  );
  const member =
    dotted && span.style === 'variableName'
      ? memberHover(value, context, dotted[1]!, name)
      : null;
  if (member) return hover(member);
  const element = elementNamed(context, name);
  if (element)
    return hover(
      `**${element.id ?? element.key}**${element.name ? `: ${element.name}` : ''} (a ${element.kind} of this model)`,
    );
  if (context.variables.includes(name))
    return hover(`**${name}**: a workbench variable`);
  return value.type === 'expression' && span.style === 'variableName'
    ? hover(`**${name}**: a variable`)
    : null;
};

/** An inspector field's hover: its element's property, read with its value type. */
export const fieldHover = (
  definition: Pick<AnyDialect, 'properties'>,
  context: DefinitionContext,
  elementId: string,
  key: string,
  text: string,
  pos: number,
): Hover | null => {
  const element = context.elements[elementId];
  const property = element && propertyOf(definition, element.kind, key);
  if (!property || property.servedBy === 'engine') return null;
  return fieldHoverAt(
    valueOf(property, element.properties),
    text,
    pos,
    context,
  );
};

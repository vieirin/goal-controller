/**
 * A link's properties in the goal language (goal-controller#107): a property
 * line with the key `link` (LINK_LINE_KEY) under the link's source element,
 * its value the target's id and one `{key = value}` per property, as the
 * language writes annotations:
 *
 *     T1: Drive
 *       link G1 {weight = 50} {kind = soft}
 *
 * It is a property line as the grammar already reads it (`KEY VALUE`): no
 * token, no grammar rule, no lexer state of its own. This module reads and
 * writes its value, and says which link a line names.
 *
 * A dialect without ids that writes link lines (`linkLines`) names the
 * target by its line's text, quoted, and the n-th of several elements so
 * named with `#n` (in the document's order):
 *
 *     Heat with the heat pump
 *       link "Low running cost" {contribution = Make}
 *       link "Comfort"#2 {contribution = Help}
 *
 * Its document reads a line starting `link "` as this one
 * (`isPlainLinkLine`): `link` is never a declared key.
 */
import {
  ACTOR_LINE_KEY,
  LINK_LINE_KEY,
  hasIds,
  linkLinesOf,
  linkPropertiesOf,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
  type DocumentLink,
  type PropertyDefinition,
} from '@goal-controller/dialect';
import { propertyKeyOf, propertyKeysOf } from '../catalog.js';
import { propertyLine, quotedName } from '../print.js';
import { valueProblem } from './values.js';

export { LINK_LINE_KEY };

/** A link line's value, read: the target as written, and its properties with their spans in the value. */
export type LinkLineReading = {
  target: string;
  targetSpan: { from: number; to: number };
  properties: readonly {
    key: string;
    value: string;
    keySpan: { from: number; to: number };
    valueSpan: { from: number; to: number };
  }[];
};

const TARGET = /^\S+?(?=\s|\{|$)/;
/** a quoted target, `\"` and `\\` escaped in it, and its ordinal: `"Heat"#2` */
const QUOTED = /^"((?:[^"\\]|\\.)*)"(?:#(\d+))?(?=\s|\{|$)/;
const PROPERTY = /\{(\s*)([A-Za-z][A-Za-z0-9_]*)(\s*=\s*)([^{}]*?)\s*\}/y;
const BLANKS = /\s*/y;

/** Reads a link line's value; an error says where it stops reading. */
export const readLinkLine = (
  value: string,
):
  | { value: LinkLineReading }
  | { error: { message: string; from: number; to: number } } => {
  const target = value.startsWith('"')
    ? QUOTED.exec(value)?.[0]
    : TARGET.exec(value)?.[0];
  if (value.startsWith('"') && !target)
    return {
      error: {
        message:
          'A link line names its target by its text, in quotes: link "Name" {key = value}',
        from: 0,
        to: value.length,
      },
    };
  if (!target || target.startsWith('{'))
    return {
      error: {
        message: 'A link line names its target first: link G1 {key = value}',
        from: 0,
        to: value.length,
      },
    };
  const properties: LinkLineReading['properties'][number][] = [];
  let at = target.length;
  for (;;) {
    BLANKS.lastIndex = at;
    BLANKS.exec(value);
    at = BLANKS.lastIndex;
    if (at >= value.length) break;
    PROPERTY.lastIndex = at;
    const match = PROPERTY.exec(value);
    if (!match)
      return {
        error: {
          message: 'Not a {key = value}',
          from: at,
          to: value.length,
        },
      };
    const [, before, key, equals, written] = match;
    const keyFrom = at + 1 + before!.length;
    const valueFrom = keyFrom + key!.length + equals!.length;
    properties.push({
      key: key!,
      value: written!,
      keySpan: { from: keyFrom, to: keyFrom + key!.length },
      valueSpan: { from: valueFrom, to: valueFrom + written!.length },
    });
    at = PROPERTY.lastIndex;
  }
  return {
    value: { target, targetSpan: { from: 0, to: target.length }, properties },
  };
};

/** A target as a dialect without ids writes it: its text, quoted, and `#n` when other elements share it. */
export const quotedTarget = (name: string, ordinal?: number): string =>
  `${quotedName(name)}${ordinal === undefined ? '' : `#${ordinal}`}`;

/** Whether a line of a document without ids is a link line (`link "…`). */
export const isPlainLinkLine = (
  definition: Parameters<typeof linkLinesOf>[0],
  text: string,
): boolean =>
  !hasIds(definition) &&
  linkLinesOf(definition) &&
  new RegExp(`^\\s*${LINK_LINE_KEY}\\s+"`).test(text);

/**
 * Whether a line of a document without ids is an actor line (`actor "…`,
 * goal-controller#109): in a dialect that gives actors properties.
 */
export const isPlainActorLine = (
  definition: Pick<AnyDialect, 'elements'> &
    Partial<Pick<AnyDialect, 'actors'>>,
  text: string,
): boolean =>
  !hasIds(definition) &&
  !!definition.actors &&
  new RegExp(`^\\s*${ACTOR_LINE_KEY}\\s+"`).test(text);

/**
 * Whether a line of a document without ids is a property line: it starts
 * with one of its dialect's declared keys (goal-controller#138).
 */
export const isPlainPropertyLine = (
  definition: Pick<AnyDialect, 'elements'> &
    Partial<Pick<AnyDialect, 'propertyLineOrder'>>,
  text: string,
): boolean => propertyKeyOf(propertyKeysOf(definition), text) !== null;

/**
 * Whether a line of a document without ids takes an element's position: any
 * nonblank line but a link, an actor or a property line (they are added and
 * removed freely, their properties read by `linkEdits`, `actorEdits` and the
 * element above).
 */
export const takesPosition = (
  definition: Parameters<typeof linkLinesOf>[0] &
    Partial<Pick<AnyDialect, 'actors' | 'propertyLineOrder'>>,
  text: string,
): boolean =>
  text.trim() !== '' &&
  !isPlainLinkLine(definition, text) &&
  !isPlainActorLine(definition, text) &&
  !isPlainPropertyLine(definition, text);

/**
 * The element a written target names: in a dialect with ids, its id; in one
 * without, by its text in `names` (`DefinitionContext['names']`), `#n` the
 * n-th so named. An error says why it names none.
 */
export const targetKey = (
  names: Readonly<Record<string, readonly string[]>> | undefined,
  target: string,
  /** what is named: an element (a link's target), an actor (an actor line) */
  noun: 'element' | 'actor' = 'element',
): { key: string } | { error: string } => {
  if (!names) return { key: target };
  const quoted = QUOTED.exec(target);
  if (!quoted) return { error: `No ${noun} ${target}` };
  const name = quoted[1]!.replace(/\\(.)/g, '$1');
  const keys = names[name] ?? [];
  const ordinal = quoted[2] === undefined ? undefined : Number(quoted[2]);
  if (!keys.length) return { error: `No ${noun} ${quotedTarget(name)}` };
  if (ordinal === undefined) {
    if (keys.length === 1) return { key: keys[0]! };
    return {
      error: `${keys.length} ${noun}s are named ${quotedTarget(name)}: write ${keys
        .map((_, i) => quotedTarget(name, i + 1))
        .join(', ')}`,
    };
  }
  const key = keys[ordinal - 1];
  return key
    ? { key }
    : {
        error: `No ${noun} ${quotedTarget(name, ordinal)}: ${keys.length} ${keys.length === 1 ? 'is' : 'are'} named so`,
      };
};

/** How a line names an element whose key is `key`: its id, or its quoted text (`names` given). */
export const writtenTarget = (
  names: Readonly<Record<string, readonly string[]>> | undefined,
  key: string,
): string => {
  if (!names) return key;
  for (const [name, keys] of Object.entries(names)) {
    const index = keys.indexOf(key);
    if (index >= 0)
      return quotedTarget(name, keys.length > 1 ? index + 1 : undefined);
  }
  return key;
};

/**
 * Whether a value can be written in a `{key = value}`: one with a brace
 * can't be read back (PROPERTY stops at a brace), so it is not written; the
 * link keeps it in the model, and the line shows the others.
 */
export const isWritableLinkValue = (value: string): boolean =>
  !/[{}]/.test(value);

/** The declared properties a link has that a line can carry, in the kind's order. */
const writableProperties = (
  definition: Pick<AnyDialect, 'links'>,
  link: Pick<DocumentLink, 'kind' | 'properties'>,
) =>
  linkPropertiesOf(definition, link.kind).filter(({ key }) => {
    const value = link.properties[key];
    return value !== undefined && isWritableLinkValue(value);
  });

/** A link line, written: `link G1 {weight = 50}`, the kind's keys in its order. */
export const linkLine = (
  definition: Pick<AnyDialect, 'links'>,
  link: Pick<DocumentLink, 'kind' | 'properties'>,
  target: string,
): string =>
  propertyLine(
    LINK_LINE_KEY,
    [
      target,
      ...writableProperties(definition, link).map(
        ({ key }) => `{${key} = ${link.properties[key]}}`,
      ),
    ].join(' '),
  );

/** Whether a link has a line: the dialect writes them, and some writable ones are set. */
export const hasLinkLine = (
  definition: Pick<AnyDialect, 'elements' | 'links'> &
    Partial<Pick<AnyDialect, 'linkLines'>>,
  link: Pick<DocumentLink, 'kind' | 'properties'>,
): boolean =>
  linkLinesOf(definition) && writableProperties(definition, link).length > 0;

/**
 * The link a line under `source` names by its `target`: among the links from
 * it to the target whose kinds have properties in the dialect. None, or more
 * than one (two kinds, ambiguous), is what the line's diagnostics say.
 */
export const linkOfLine = <
  L extends Pick<DocumentLink, 'kind' | 'source' | 'target'>,
>(
  definition: Pick<AnyDialect, 'links'>,
  links: readonly L[],
  source: string,
  target: string,
): L[] =>
  links.filter(
    (link) =>
      link.source === source &&
      link.target === target &&
      linkPropertiesOf(definition, link.kind).length > 0,
  );

/** What is wrong with a link line's properties, for a link of this kind: the written property (its index), and where. */
export const linkPropertyProblems = (
  definition: Pick<AnyDialect, 'links'> &
    Partial<Pick<AnyDialect, 'properties'>>,
  kind: string,
  read: LinkLineReading,
  context?: DefinitionContext,
): { index: number; on: 'key' | 'value'; message: string }[] =>
  writtenPropertyProblems(
    linkPropertiesOf(definition, kind),
    kind,
    read,
    context,
    definition.properties && { properties: definition.properties },
  );

/**
 * What is wrong with a line's `{key = value}` properties (a link's, an
 * actor's) against what its kind declares: the written property (its
 * index), and where.
 */
export const writtenPropertyProblems = (
  declared: readonly PropertyDefinition[],
  kind: string,
  read: Pick<LinkLineReading, 'properties'>,
  /** the model, which a reference in a value names (goal-controller#152) */
  context?: DefinitionContext,
  definition?: Pick<AnyDialect, 'properties'>,
): { index: number; on: 'key' | 'value'; message: string }[] => {
  const properties = Object.fromEntries(
    read.properties.map(({ key, value }) => [key, value]),
  );
  const problems: { index: number; on: 'key' | 'value'; message: string }[] =
    [];
  const seen = new Set<string>();
  for (const [index, { key, value }] of read.properties.entries()) {
    if (seen.has(key)) {
      problems.push({ index, on: 'key', message: `${key} is written twice` });
      continue;
    }
    seen.add(key);
    const property = declared.find((p) => p.key === key);
    if (!property) {
      problems.push({
        index,
        on: 'key',
        message: `Not a property of a ${kind.replace(/^[^.]+\./, '')}`,
      });
      continue;
    }
    const problem = valueProblem(
      valueOf(property, properties),
      value,
      context,
      definition,
    );
    if (problem) problems.push({ index, on: 'value', message: problem });
  }
  return problems;
};

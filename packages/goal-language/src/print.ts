/**
 * Writing the goal language (no parser here): element lines with their
 * annotations and declaration, and property lines. What a dialect decides is
 * only whether its lines have ids (`G1: Name`) or not (`Name`).
 */
import {
  hasIds,
  kindWord,
  shortId,
  type AnyDialect,
} from '@goal-controller/dialect';
import { propertyKeyOf, propertyKeysOf } from './catalog.js';

/** The properties a line's annotations or declaration set, by key. */
export type DeclaredProperties = Partial<Record<string, string>>;

/**
 * An element's text, as its name stores it: `G1: Name [G2;G3]` (or `Name
 * [...]` without runtime ids; `net_up: Name` where its text gave it an id,
 * `hasId`, goal-controller#518; none where it gave none, `hasId: false`).
 */
export const elementLine = (
  definition: Pick<AnyDialect, 'elements'>,
  parts: {
    id: string;
    name: string;
    notation: string | null;
    hasId?: boolean;
  },
  declaration?: string | null,
  annotations?: string | null,
): string => {
  const name = parts.name.trim();
  // an engine's element without a runtime id stores none (goal-controller#518)
  const base =
    (parts.hasId ?? hasIds(definition)) ? `${parts.id}: ${name}` : name;
  const line = parts.notation?.trim()
    ? `${base} [${parts.notation.trim()}]`
    : base;
  const declared = declaration ? `${line} ${declaration}` : line;
  return annotations ? `${annotations} ${declared}` : declared;
};

/** Whether an element's text gave it an id (`hasId`; none said: an id other than its piStar id). */
export const hasWrittenId = (node: {
  id: string;
  iStarId: string;
  hasId?: boolean;
}): boolean => node.hasId ?? node.id !== node.iStarId;

/** The id an element's line shows: its own, or its piStar id's first characters (`shortId`). */
export const shownId = (node: {
  id: string;
  iStarId: string;
  hasId?: boolean;
}): string => (hasWrittenId(node) ? node.id : shortId(node.iStarId));

/**
 * An element's line in a document (goal-controller#518): its kind's word,
 * the id it shows (`shownId`) and its name, `goal G1: Deliver [G2;G3]`,
 * `behavioral_goal 7857cb00: Achieve [Manual Backup]`; its annotations
 * before, its declaration after.
 */
export const documentLine = (
  definition: Pick<AnyDialect, 'elements'>,
  node: {
    kind: string;
    id: string;
    iStarId: string;
    hasId?: boolean;
    name: string;
    notation: string | null;
  },
  declaration?: string | null,
  annotations?: string | null,
): string => {
  const line = `${kindWord(node.kind)} ${shownId(node)}: ${elementLine(
    { elements: {} },
    { ...node, hasId: false },
    declaration,
  )}`;
  return annotations ? `${annotations} ${line}` : line;
};

/** A name in quotes, `\"` and `\\` escaped in it: `"Low running cost"`. */
export const quotedName = (name: string): string =>
  `"${name.replace(/[\\"]/g, '\\$&')}"`;

/**
 * A name as a line without an id writes it (goal-controller#138): quoted
 * (`quotedName`) where its dialect has property lines and the name would
 * read as one (it starts with a declared key) or is quoted itself; as it is
 * otherwise. A line reads it back with `unquotedName`.
 */
export const writtenName = (
  definition: Pick<AnyDialect, 'elements'> &
    Partial<Pick<AnyDialect, 'propertyLineOrder'>>,
  name: string,
): string => {
  const keys = propertyKeysOf(definition);
  return keys.length &&
    (propertyKeyOf(keys, name) !== null || QUOTED_NAME.test(name.trim()))
    ? quotedName(name.trim())
    : name;
};

const QUOTED_NAME = /^"((?:[^"\\]|\\.)*)"$/;

/** The name a quoted one is (`writtenName`), null if it is not quoted. */
export const unquotedName = (written: string): string | null => {
  const quoted = QUOTED_NAME.exec(written);
  return quoted ? quoted[1]!.replace(/\\(.)/g, '$1') : null;
};

/** `<<stereotype>> {tag = tagValue}` from the properties they set (null: none set). */
export const writeAnnotations = (
  properties: DeclaredProperties,
): string | null => {
  const { stereotype, tag, tagValue } = properties;
  const written = [
    stereotype ? `<<${stereotype}>>` : null,
    tag
      ? tagValue !== undefined
        ? `{${tag} = ${tagValue}}`
        : `{${tag}}`
      : null,
  ].filter((text): text is string => text !== null);
  return written.length ? written.join(' ') : null;
};

/**
 * `{int 0..100 = 80}` from the properties it sets: the bounds when both are
 * set, the initial value when set (null without a type: nothing is declared).
 */
export const writeDeclaration = (
  properties: DeclaredProperties,
): string | null => {
  const { type, lowerBound, upperBound, initialValue } = properties;
  if (!type) return null;
  const bounds =
    lowerBound !== undefined && upperBound !== undefined
      ? ` ${lowerBound}..${upperBound}`
      : '';
  const initial = initialValue !== undefined ? ` = ${initialValue}` : '';
  return `{${type}${bounds}${initial}}`;
};

/** A property line's text: `maintain battery > 20` (the key alone when empty). */
export const propertyLine = (key: string, value: string): string =>
  oneLine(value) ? `${key} ${oneLine(value)}` : key;

/**
 * A property value as one line: its line breaks and the blanks around them
 * one space (a line of the document holds one line; goal-controller#518: an
 * imported `.kaos` description runs over several). What a document writes
 * and reads of a value, so a value that has breaks reads back as itself.
 */
export const oneLine = (value: string): string =>
  value.trim().replace(/\s*\n\s*/g, ' ');

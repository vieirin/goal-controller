/**
 * Writing the goal language (no parser here): element lines with their
 * annotations and declaration, and property lines. What a dialect decides is
 * only whether its lines have ids (`G1: Name`) or not (`Name`).
 */
import { hasIds, type AnyDialect } from '@goal-controller/dialect';
import { propertyKeyOf, propertyKeysOf } from './catalog.js';

/** The properties a line's annotations or declaration set, by key. */
export type DeclaredProperties = Partial<Record<string, string>>;

/** An element line's text: `G1: Name [G2;G3]` (or `Name [...]` without ids). */
export const elementLine = (
  definition: Pick<AnyDialect, 'elements'>,
  parts: { id: string; name: string; notation: string | null },
  declaration?: string | null,
  annotations?: string | null,
): string => {
  const name = parts.name.trim();
  const base = hasIds(definition) ? `${parts.id}: ${name}` : name;
  const line = parts.notation?.trim()
    ? `${base} [${parts.notation.trim()}]`
    : base;
  const declared = declaration ? `${line} ${declaration}` : line;
  return annotations ? `${annotations} ${declared}` : declared;
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
  value.trim() ? `${key} ${value.trim()}` : key;

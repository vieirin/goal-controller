/**
 * Writing the goal language (no parser here): element lines with their
 * annotations and declaration, and property lines. What a dialect decides is
 * only whether its lines have ids (`G1: Name`) or not (`Name`).
 */
import { hasIds, type AnyDialect } from '@goal-controller/dialect';

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

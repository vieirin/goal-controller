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
 */
import {
  LINK_LINE_KEY,
  linkPropertiesOf,
  valueOf,
  type AnyDialect,
  type DocumentLink,
} from '@goal-controller/dialect';
import { propertyLine } from '../print.js';
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
const PROPERTY = /\{(\s*)([A-Za-z][A-Za-z0-9_]*)(\s*=\s*)([^{}]*?)\s*\}/y;
const BLANKS = /\s*/y;

/** Reads a link line's value; an error says where it stops reading. */
export const readLinkLine = (
  value: string,
):
  | { value: LinkLineReading }
  | { error: { message: string; from: number; to: number } } => {
  const target = TARGET.exec(value)?.[0];
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
      ...linkPropertiesOf(definition, link.kind)
        .filter(({ key }) => link.properties[key] !== undefined)
        .map(({ key }) => `{${key} = ${link.properties[key]}}`),
    ].join(' '),
  );

/** Whether a link has a line: its kind has properties in the dialect, and some are set. */
export const hasLinkLine = (
  definition: Pick<AnyDialect, 'links'>,
  link: Pick<DocumentLink, 'kind' | 'properties'>,
): boolean =>
  linkPropertiesOf(definition, link.kind).some(
    ({ key }) => link.properties[key] !== undefined,
  );

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
  definition: Pick<AnyDialect, 'links'>,
  kind: string,
  read: LinkLineReading,
): { index: number; on: 'key' | 'value'; message: string }[] => {
  const declared = linkPropertiesOf(definition, kind);
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
    const problem = valueProblem(valueOf(property, properties), value);
    if (problem) problems.push({ index, on: 'value', message: problem });
  }
  return problems;
};

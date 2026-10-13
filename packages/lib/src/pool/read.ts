/**
 * A file read with a tree parser and its schema (from goal-controller#81):
 * the parser gives a tree with offsets (jsonc-parser's `Node`: JSON's, or
 * XML's and YAML's in the same shape), the schema checks its value, and
 * Zod's issues become problems at their path's offsets.
 *
 * Lenient, as an editor needs: a node the schema rejects is left out (a bad
 * list item, then the entry it leaves incomplete) and the rest is read. A
 * file that doesn't parse at all keeps its last good reading. A text read
 * already is not read again.
 */
import { findNodeAtLocation, getNodeValue, type Node } from 'jsonc-parser';
import { safeParse, type $ZodIssue, type $ZodType } from 'zod/v4/core';

export type { Node } from 'jsonc-parser';

/** A value's place in the file's value: keys and indexes (`['type_mapping', 0, 'ocl_type']`). */
export type ValuePath = readonly (string | number)[];

/** Where something is written: offsets, and the text between them. */
export type Span = { from: number; to: number; text: string };

/** A path's span in the file (a key's, with `'key'`); none when it isn't written. */
export type At = (path: ValuePath, part?: 'key') => Span | undefined;

export type ReadProblem = {
  /** the schema's (a value it rejects), not the syntax's */
  schema?: true;
  severity: 'error' | 'warning';
  message: string;
  from: number;
  to: number;
};

export type Parsed = {
  /** none when nothing could be read */
  tree: Node | undefined;
  /** what is wrong with the syntax */
  problems: ReadProblem[];
};

/** What a file is read with: its parser's tree, and its schema. */
export type TreeReader = {
  parse: (text: string) => Parsed;
  /** Zod's, classic or mini */
  schema: $ZodType;
};

export type Reading = {
  /** the valid part of the value (none when nothing could be read) */
  value: unknown;
  /** where each path of the value is written */
  at: At;
  problems: ReadProblem[];
  /** the file doesn't parse: value and `at` are its last good reading's */
  stale?: true;
};

const nowhere: At = () => undefined;

const spanOf = (text: string, node: Node): Span => ({
  from: node.offset,
  to: node.offset + node.length,
  text: text.slice(node.offset, node.offset + node.length),
});

/** A node, or its property's key node, by path. */
const nodeAt = (tree: Node, path: ValuePath, part?: 'key') => {
  const node = path.length
    ? findNodeAtLocation(tree, path as (string | number)[])
    : tree;
  return part === 'key'
    ? node?.parent?.type === 'property'
      ? node.parent.children?.[0]
      : undefined
    : node;
};

/** The node an issue at `path` is about: the deepest one written. */
const writtenAt = (tree: Node, path: ValuePath) => {
  for (let length = path.length; length > 0; length--) {
    const node = nodeAt(tree, path.slice(0, length));
    if (node) return { node, missing: length < path.length };
  }
  return { node: tree, missing: path.length > 0 };
};

/** Takes a node out of its object or list (the root: nothing is left). */
const remove = (tree: Node, node: Node): Node | undefined => {
  const child = node.parent?.type === 'property' ? node.parent : node;
  const siblings = child.parent?.children;
  if (!siblings) return undefined;
  siblings.splice(siblings.indexOf(child), 1);
  return tree;
};

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');
/** Zod's names for JSON's shapes */
const shape = (expected: string) =>
  ({ array: 'list', record: 'object' })[expected] ?? expected;
const named = (key: PropertyKey | undefined) =>
  typeof key === 'string' ? `\`${key}\`` : 'an item';

/** A Zod issue in words a file's author reads. */
const messageOf = (
  issue: $ZodIssue,
  written: { missing: boolean; value?: unknown },
): string => {
  const key = issue.path[issue.path.length - 1];
  switch (issue.code) {
    case 'invalid_type':
      return written.missing
        ? `Missing ${named(key)}`
        : `${typeof key === 'string' ? `\`${key}\`` : 'This'} should be ${article(shape(issue.expected))} ${shape(issue.expected)}, not ${valueType(written.value)}`;
    case 'invalid_value':
      return `Expected ${issue.values.map((value) => JSON.stringify(value)).join(' or ')}`;
    case 'unrecognized_keys':
      return `Not read here: ${issue.keys.map((k) => `\`${k}\``).join(', ')}`;
    default:
      return issue.message;
  }
};

const valueType = (value: unknown) =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? 'a list'
      : typeof value === 'object'
        ? 'an object'
        : `${article(typeof value)} ${typeof value}`;

/** The problems an issue is, where each is written (an unknown key: at the key). */
const problemsOf = (
  text: string,
  tree: Node,
  issue: $ZodIssue,
): ReadProblem[] => {
  if (issue.code === 'unrecognized_keys')
    return issue.keys.map((key) => {
      const span = spanOf(
        text,
        nodeAt(tree, [...(issue.path as ValuePath), key], 'key')!,
      );
      return {
        schema: true,
        severity: 'warning',
        message: messageOf({ ...issue, keys: [key] }, { missing: false }),
        from: span.from,
        to: span.to,
      };
    });
  const { node, missing } = writtenAt(tree, issue.path as ValuePath);
  // missing from an object: at the object's key, or its first character
  const key = missing ? keyOf(node) : undefined;
  const span = spanOf(text, key ?? node);
  return [
    {
      schema: true,
      severity: 'error',
      message: messageOf(issue, { missing, value: getNodeValue(node) }),
      from: span.from,
      to: missing && !key ? span.from + 1 : span.to,
    },
  ];
};

const keyOf = (node: Node) =>
  node.parent?.type === 'property' ? node.parent.children?.[0] : undefined;

/** An object without the keys its schema doesn't know. */
const dropKeys = (tree: Node, issue: $ZodIssue) => {
  if (issue.code !== 'unrecognized_keys') return tree;
  for (const key of issue.keys) {
    const node = nodeAt(tree, [...(issue.path as ValuePath), key]);
    if (node) remove(tree, node);
  }
  return tree;
};

/** each reader's last reading of each document, and its last good one */
const readings = new WeakMap<
  object,
  Map<string, { text: string; reading: Reading; good?: Reading }>
>();

/**
 * A file's reading: its syntax problems and the schema's, and the valid
 * value with where it is written. `document` names it, for its last good
 * reading; the memo is held by `reader`.
 */
export const read = (
  reader: TreeReader,
  document: string,
  text: string,
): Reading => {
  const documents =
    readings.get(reader) ?? readings.set(reader, new Map()).get(reader)!;
  const last = documents.get(document);
  if (last?.text === text) return last.reading;
  const { tree, problems } = reader.parse(text);
  // an empty file reads as nothing; one that doesn't parse, as it last did
  if (!tree) {
    const good = problems.length && text.trim() ? last?.good : undefined;
    const reading: Reading = good
      ? { ...good, problems, stale: true }
      : { value: undefined, at: nowhere, problems };
    documents.set(document, { text, reading, ...(good && { good }) });
    return reading;
  }
  let valid: Node | undefined = tree;
  let result = safeParse(reader.schema, getNodeValue(valid));
  if (!result.success)
    for (const issue of result.error.issues)
      problems.push(...problemsOf(text, tree, issue));
  // leave out what the schema rejects, deepest first, until the rest is valid
  while (!result.success && valid) {
    const issue = result.error.issues[0]!;
    valid =
      issue.code === 'unrecognized_keys'
        ? dropKeys(valid, issue)
        : remove(valid, writtenAt(valid, issue.path as ValuePath).node);
    if (valid) result = safeParse(reader.schema, getNodeValue(valid));
  }
  const at: At = (path, part) => {
    const node = valid && nodeAt(valid, path, part);
    return node && spanOf(text, node);
  };
  const reading: Reading =
    valid && result.success
      ? { value: result.data, at, problems }
      : { value: undefined, at: nowhere, problems };
  const good = reading.value !== undefined ? reading : last?.good;
  documents.set(document, { text, reading, ...(good && { good }) });
  return reading;
};

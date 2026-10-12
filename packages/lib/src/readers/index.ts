/**
 * Typed readers (goal-controller#79): a file kind is a standard parser that
 * keeps positions, a Zod schema and what the valid value means. The parser
 * gives a tree (jsonc-parser's `Node`: JSON's, or XML's in the same shape),
 * the schema checks its value, and Zod's issues become problems at their
 * path's offsets. Engine-free: an engine's reader maps its typed value to
 * facts, data or symbols; nothing here knows a file kind.
 *
 * Lenient, as an editor needs: a node the schema rejects is left out (a bad
 * list item, then the entry it leaves incomplete) and the rest is read. A
 * file that doesn't parse at all keeps its last good reading. A text read
 * already is not read again (a model edit leaves the resources as they are).
 */
import { findNodeAtLocation, getNodeValue, type Node } from 'jsonc-parser';
import { safeParse, type $ZodIssue, type $ZodType } from 'zod/v4/core';

export type { Node } from 'jsonc-parser';

/** A value's place in the file's value: keys and indexes (`['type_mapping', 0, 'ocl_type']`). */
export type Path = readonly (string | number)[];

/** Where something is written: offsets, and the text between them. */
export type Span = { from: number; to: number; text: string };

/** A path's span in the file (a key's, with `'key'`); none when it isn't written. */
export type At = (path: Path, part?: 'key') => Span | undefined;

export type ReadProblem = {
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

/**
 * A file kind: how its text is parsed, what its value must be, and what it
 * means (`facts`), given where each part is written.
 */
export type Reader<T, F> = {
  parse: (text: string) => Parsed;
  /** Zod's, classic or mini (`zod/mini` keeps the bundle small) */
  schema: $ZodType<T>;
  /** what the value means, as `document` (the file's name) */
  facts: (value: T, at: At, document: string) => F;
};

export type Reading<T, F> = {
  /** the valid part of the value (none when nothing could be read) */
  value: T | undefined;
  /** what the reader made of it, positions included (the tree isn't kept) */
  facts: F | undefined;
  problems: ReadProblem[];
  /** the file doesn't parse: value and facts are its last good reading's */
  stale?: true;
};

const spanOf = (text: string, node: Node): Span => ({
  from: node.offset,
  to: node.offset + node.length,
  text: text.slice(node.offset, node.offset + node.length),
});

/** A node, or its property's key node, by path. */
const nodeAt = (tree: Node, path: Path, part?: 'key') => {
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
const writtenAt = (tree: Node, path: Path) => {
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
        nodeAt(tree, [...(issue.path as Path), key], 'key')!,
      );
      return {
        severity: 'warning',
        message: messageOf({ ...issue, keys: [key] }, { missing: false }),
        from: span.from,
        to: span.to,
      };
    });
  const { node, missing } = writtenAt(tree, issue.path as Path);
  // missing from an object: at the object's key, or its first character
  const key = missing ? keyOf(node) : undefined;
  const span = spanOf(text, key ?? node);
  return [
    {
      severity: 'error',
      message: messageOf(issue, { missing, value: getNodeValue(node) }),
      from: span.from,
      to: missing && !key ? span.from + 1 : span.to,
    },
  ];
};

const keyOf = (node: Node) =>
  node.parent?.type === 'property' ? node.parent.children?.[0] : undefined;

/** each reader's last reading of each document, and its last good one */
const readings = new WeakMap<
  object,
  Map<
    string,
    {
      text: string;
      reading: Reading<unknown, unknown>;
      good?: Reading<unknown, unknown>;
    }
  >
>();

/**
 * A file's reading: its syntax problems and the schema's, and the facts of
 * what is valid. `document` names it, for its last good reading.
 */
export const read = <T, F>(
  reader: Reader<T, F>,
  document: string,
  text: string,
): Reading<T, F> => {
  const documents =
    readings.get(reader) ?? readings.set(reader, new Map()).get(reader)!;
  const last = documents.get(document) as
    | { text: string; reading: Reading<T, F>; good?: Reading<T, F> }
    | undefined;
  if (last?.text === text) return last.reading;
  const { tree, problems } = reader.parse(text);
  // an empty file reads as nothing; one that doesn't parse, as it last did
  if (!tree) {
    const good = problems.length && text.trim() ? last?.good : undefined;
    const reading: Reading<T, F> = good
      ? { ...good, problems, stale: true }
      : { value: undefined, facts: undefined, problems };
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
    const { node } = writtenAt(valid, result.error.issues[0]!.path as Path);
    valid =
      result.error.issues[0]!.code === 'unrecognized_keys'
        ? dropKeys(valid, result.error.issues[0]!)
        : remove(valid, node);
    if (valid) result = safeParse(reader.schema, getNodeValue(valid));
  }
  const at: At = (path, part) => {
    const node = valid && nodeAt(valid, path, part);
    return node && spanOf(text, node);
  };
  const reading: Reading<T, F> =
    valid && result.success
      ? {
          value: result.data,
          facts: reader.facts(result.data, at, document),
          problems,
        }
      : { value: undefined, facts: undefined, problems };
  const good = reading.value !== undefined ? reading : last?.good;
  documents.set(document, { text, reading, ...(good && { good }) });
  return reading;
};

/** An object without the keys its schema doesn't know. */
const dropKeys = (tree: Node, issue: $ZodIssue) => {
  if (issue.code !== 'unrecognized_keys') return tree;
  for (const key of issue.keys) {
    const node = nodeAt(tree, [...(issue.path as Path), key]);
    if (node) remove(tree, node);
  }
  return tree;
};

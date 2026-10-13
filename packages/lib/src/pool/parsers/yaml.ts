/**
 * YAML for a typed reader: the `yaml` package's document, with its ranges,
 * in the tree shape the readers share (jsonc-parser's `Node`). A mapping is
 * an object, a sequence a list, a scalar its value; a string's span is its
 * text, without quotes. A key written twice is an error (YAML's rule). An
 * alias reads as what it names, at the alias.
 */
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type Node as YamlNode,
} from 'yaml';
import type { Node, Parsed, ReadProblem } from '../read';

/** a node being built: its parent set once it has one */
type Built = { -readonly [K in keyof Node]: Node[K] };

const span = (node: YamlNode) => {
  const [from, to] = node.range ?? [0, 0];
  return { offset: from, length: to - from };
};

/** a quoted scalar's span: its text, without the quotes */
const unquoted = (node: YamlNode, text: string) => {
  const { offset, length } = span(node);
  const first = text[offset];
  return (first === '"' || first === "'") && length >= 2
    ? { offset: offset + 1, length: length - 2 }
    : { offset, length };
};

const toNode = (
  node: YamlNode | null,
  text: string,
  at: number,
  doc: Document,
): Built => {
  if (node === null)
    return { type: 'null', value: null, offset: at, length: 0 };
  if (isAlias(node)) {
    const { offset, length } = span(node);
    const value = node.resolve(doc);
    return value
      ? { ...toNode(value as YamlNode, text, offset, doc), offset, length }
      : { type: 'null', value: null, offset, length };
  }
  if (isMap(node)) {
    const object: Built = { type: 'object', ...span(node), children: [] };
    for (const pair of node.items) {
      const key = pair.key as YamlNode | null;
      if (!key || !isScalar(key)) continue;
      const keyNode: Built = {
        type: 'string',
        value: String(key.value),
        ...unquoted(key, text),
      };
      const end = keyNode.offset + keyNode.length;
      const value = toNode(pair.value as YamlNode | null, text, end, doc);
      const property: Built = {
        type: 'property',
        offset: keyNode.offset,
        length: Math.max(value.offset + value.length, end) - keyNode.offset,
        parent: object,
        children: [keyNode, value],
      };
      keyNode.parent = property;
      value.parent = property;
      object.children!.push(property);
    }
    return object;
  }
  if (isSeq(node)) {
    const array: Built = { type: 'array', ...span(node), children: [] };
    for (const item of node.items) {
      const child = toNode(
        item as YamlNode | null,
        text,
        span(node).offset,
        doc,
      );
      child.parent = array;
      array.children!.push(child);
    }
    return array;
  }
  if (isScalar(node)) {
    const { value } = node;
    if (typeof value === 'string')
      return { type: 'string', value, ...unquoted(node, text) };
    if (typeof value === 'number')
      return { type: 'number', value, ...span(node) };
    if (typeof value === 'boolean')
      return { type: 'boolean', value, ...span(node) };
    return { type: 'null', value: null, ...span(node) };
  }
  return { type: 'null', value: null, ...span(node) };
};

export const parseYaml = (text: string): Parsed => {
  const document = parseDocument(text, { prettyErrors: false });
  const problems: ReadProblem[] = document.errors.map(({ message, pos }) => ({
    severity: 'error',
    message: `Not valid YAML: ${message.split('\n')[0]}`,
    from: pos[0],
    to: Math.max(pos[1], pos[0] + 1),
  }));
  const root = document.contents as YamlNode | null;
  // what doesn't parse has no tree (its last good reading stands)
  if (problems.length || root === null) return { tree: undefined, problems };
  return { tree: toNode(root, text, 0, document) as Node, problems };
};

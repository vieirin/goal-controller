/**
 * XML for a typed reader: @rgrove/parse-xml's elements, with their offsets,
 * in the tree shape the readers share (jsonc-parser's `Node`). An element is
 * an object: `name` (its opening tag's name), `close` (its closing tag's,
 * unless self-closed), `attributes`, `children` (its elements) and `text`
 * (trimmed; only an element without children has it). The parser stops at
 * the first error: a file that doesn't parse has no tree.
 */
import { parseXml, XmlElement, XmlError, XmlText } from '@rgrove/parse-xml';
import type { Node, Parsed } from '.';

/** a node being built: its parent set once it has one */
type Built = { -readonly [K in keyof Node]: Node[K] };

/** A value node, its key and their property, under `parent`. */
const property = (parent: Node, key: string, value: Built): void => {
  const node: Built = {
    type: 'property',
    offset: value.offset,
    length: value.length,
    parent,
    children: [],
  };
  value.parent = node;
  node.children!.push(
    {
      type: 'string',
      value: key,
      offset: value.offset,
      length: value.length,
      parent: node,
    },
    value,
  );
  parent.children!.push(node);
};

const string = (value: string, from: number, to: number): Built => ({
  type: 'string',
  value,
  offset: from,
  length: to - from,
});

const elementNode = (text: string, element: XmlElement): Built => {
  const node: Built = {
    type: 'object',
    offset: element.start,
    length: element.end - element.start,
    children: [],
  };
  const { name } = element;
  property(
    node,
    'name',
    string(name, element.start + 1, element.start + 1 + name.length),
  );
  const selfClosed = text.slice(element.end - 2, element.end) === '/>';
  if (!selfClosed) {
    const close = text.lastIndexOf(`</${name}`, element.end) + 2;
    property(node, 'close', string(name, close, close + name.length));
  }
  const tag = text.slice(element.start, text.indexOf('>', element.start));
  const attributes: Built = {
    type: 'object',
    offset: element.start,
    length: tag.length,
    children: [],
  };
  for (const [key, value] of Object.entries(element.attributes)) {
    const written = new RegExp(`\\s${key}\\s*=\\s*(["'])`).exec(tag);
    const from =
      element.start + (written ? written.index + written[0].length : 0);
    property(attributes, key, string(value, from, from + value.length));
  }
  property(node, 'attributes', attributes);
  const elements = element.children.filter(
    (child): child is XmlElement => child instanceof XmlElement,
  );
  const children: Built = {
    type: 'array',
    offset: element.start,
    length: element.end - element.start,
    children: elements.map((child) => elementNode(text, child)),
  };
  children.children!.forEach((child) => ((child as Built).parent = children));
  property(node, 'children', children);
  const texts = element.children.filter(
    (child): child is XmlText => child instanceof XmlText,
  );
  const value = texts
    .map((child) => child.text)
    .join('')
    .trim();
  if (!elements.length && value) {
    const raw = text.slice(texts[0]!.start, texts[texts.length - 1]!.end);
    const from = texts[0]!.start + raw.length - raw.trimStart().length;
    property(node, 'text', string(value, from, from + raw.trim().length));
  }
  return node;
};

export const parseXmlTree = (text: string): Parsed => {
  try {
    const { root } = parseXml(text, { includeOffsets: true });
    return { tree: root ? elementNode(text, root) : undefined, problems: [] };
  } catch (error) {
    if (!(error instanceof XmlError)) throw error;
    const [message] = error.message.split('\n');
    return {
      tree: undefined,
      problems: [
        {
          severity: 'error',
          message: `Not valid XML: ${message!.replace(/ \(line \d+, column \d+\)$/, '')}`,
          from: Math.min(error.pos, Math.max(text.length - 1, 0)),
          to: Math.min(error.pos + 1, text.length),
        },
      ],
    };
  }
};

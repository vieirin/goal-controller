/**
 * EMF XMI read into typed nodes, for any metamodel (goal-controller#135):
 * the reader every XMI importer starts from. Each XML element is a node:
 * its containment feature (the element's name), its `xsi:type`, its id,
 * its attributes and its contained nodes. References are resolved in the
 * forms EMF writes them: an id list (`linksSrc="62 63"`), a path fragment
 * (`//@actors.0/@goals.2`), and an `href` (`other.ecore#//@x.0`, or `#id`)
 * into the same document. What can't be resolved is a diagnostic. The
 * caller maps node types to piStar; nothing here knows a metamodel.
 */
import * as z from 'zod/mini';
import { readXml, type XmlElement } from '../formats/xml';

export type XmiDiagnostic = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** where in the text, when it is one element's */
  from?: number;
  to?: number;
};

/** An XML element of an XMI document, as EMF means it. */
export type XmiNode = {
  /** the containment feature it is in (its element's name: `intElements`); the root's tag */
  feature: string;
  /** its `xsi:type` (`shop:Chore`), or null when it has none (its feature's type) */
  type: string | null;
  /** its id (`xmi:id`, or the attribute the reader is told ids are in), or null */
  id: string | null;
  /** its path fragment (`//@actors.0/@goals.2`; the root's is `/`) */
  path: string;
  /** its attributes as written, `xsi:type` and the id among them */
  attributes: Readonly<Record<string, string>>;
  /** what it contains, in the file's order */
  children: XmiNode[];
  parent: XmiNode | null;
  /** the XML element it is (positions, text) */
  element: XmlElement;
};

export type XmiDocument = {
  root: XmiNode;
  /** every node, depth-first in the file's order */
  nodes: XmiNode[];
  /** a node by its id */
  byId: ReadonlyMap<string, XmiNode>;
  /** a node by its path fragment */
  byPath: ReadonlyMap<string, XmiNode>;
};

export type XmiOptions = {
  /** the attribute ids are in (default `xmi:id`; some tools key by `id`) */
  idAttribute?: string;
  /** the document's file name, so an `href` into it (`model.xmi#…`) resolves */
  fileName?: string;
};

/** A reader over one XMI document: its nodes, and its references resolved, with diagnostics. */
export type XmiReader = {
  document: XmiDocument;
  diagnostics: XmiDiagnostic[];
  /** a node's children in one containment feature */
  children: (node: XmiNode | undefined, feature: string) => XmiNode[];
  /**
   * The node one reference names: an id, `#id`, a path fragment
   * (`//@actors.0`, `#//@actors.0`), or `file#fragment` into this document;
   * null when it names none (no diagnostic: `references` gives those).
   */
  resolve: (reference: string) => XmiNode | null;
  /**
   * The nodes a node's reference feature names: its attribute (an id list,
   * or path fragments, space-separated), or its children of that name with
   * an `href` (EMF's form for a reference into a file). What doesn't
   * resolve is a diagnostic, and left out.
   */
  references: (node: XmiNode, feature: string) => XmiNode[];
  /**
   * A node's attributes, typed by a zod schema; null (and an error) when
   * they don't fit: the caller leaves the node out.
   */
  typed: <S extends z.ZodMiniType>(
    schema: S,
    node: XmiNode,
  ) => z.infer<S> | null;
};

const XSI_TYPE = 'xsi:type';

/** `<intElements id="7">`, `<goals xmi:id="_a">`: how a diagnostic names a node. */
const nameOf = (node: XmiNode) =>
  `<${node.feature}${node.id ? ` id="${node.id}"` : ''}>`;

/**
 * An XMI text read into nodes, or the reason it can't be: an XML problem is
 * an error diagnostic and no reader.
 */
export const readXmi = (
  text: string,
  { idAttribute = 'xmi:id', fileName }: XmiOptions = {},
): { reader: XmiReader | null; diagnostics: XmiDiagnostic[] } => {
  const diagnostics: XmiDiagnostic[] = [];
  const { root, problems } = readXml(text);
  for (const problem of problems)
    diagnostics.push({
      severity: 'error',
      message: problem.message,
      from: problem.from,
      to: problem.to,
    });
  if (!root || problems.length) return { reader: null, diagnostics };

  const nodes: XmiNode[] = [];
  const byId = new Map<string, XmiNode>();
  const byPath = new Map<string, XmiNode>();
  const nodeOf = (
    element: XmlElement,
    parent: XmiNode | null,
    path: string,
  ): XmiNode => {
    const node: XmiNode = {
      feature: element.name,
      type: element.attributes[XSI_TYPE] ?? null,
      id: element.attributes[idAttribute] ?? null,
      path,
      attributes: element.attributes,
      children: [],
      parent,
      element,
    };
    nodes.push(node);
    byPath.set(path, node);
    if (node.id !== null) {
      if (byId.has(node.id))
        diagnostics.push({
          severity: 'warning',
          message: `${nameOf(node)}: id ${node.id} is another node's too; references name the first`,
          from: element.from,
          to: element.to,
        });
      else byId.set(node.id, node);
    }
    // EMF's fragment: `@feature.index` among the parent's children of that feature
    const seen = new Map<string, number>();
    for (const child of element.children) {
      const index = seen.get(child.name) ?? 0;
      seen.set(child.name, index + 1);
      const prefix = parent ? path : '/';
      node.children.push(
        nodeOf(child, node, `${prefix}/@${child.name}.${index}`),
      );
    }
    return node;
  };
  const rootNode = nodeOf(root, null, '/');
  const document: XmiDocument = { root: rootNode, nodes, byId, byPath };

  const resolve = (reference: string): XmiNode | null => {
    const hash = reference.indexOf('#');
    const file = hash < 0 ? '' : reference.slice(0, hash);
    // a reference into another file isn't this document's
    if (file && file !== fileName) return null;
    const fragment = hash < 0 ? reference : reference.slice(hash + 1);
    if (fragment.startsWith('/')) {
      // `//@actors.0`; EMF may leave out `.0` for a single-valued feature
      const path = fragment.replace(/\/@([^/.]+)(?=\/|$)/g, '/@$1.0');
      return byPath.get(path) ?? null;
    }
    return byId.get(fragment) ?? null;
  };

  const unresolved = (node: XmiNode, feature: string, reference: string) => {
    const hash = reference.indexOf('#');
    const file = hash < 0 ? '' : reference.slice(0, hash);
    diagnostics.push({
      severity: 'warning',
      message:
        file && file !== fileName
          ? `${nameOf(node)}: ${feature} names ${reference}, in another file; left out`
          : `${nameOf(node)}: ${feature} names ${reference}, which the document doesn't have; left out`,
      from: node.element.from,
      to: node.element.to,
    });
  };

  const reader: XmiReader = {
    document,
    diagnostics,
    children: (node, feature) =>
      node?.children.filter((child) => child.feature === feature) ?? [],
    resolve,
    references: (node, feature) => {
      const written = [
        ...(node.attributes[feature]?.split(/\s+/).filter(Boolean) ?? []),
        ...node.children
          .filter((child) => child.feature === feature)
          .flatMap((child) => child.attributes.href ?? []),
      ];
      return written.flatMap((reference) => {
        const found = resolve(reference);
        if (!found) unresolved(node, feature, reference);
        return found ? [found] : [];
      });
    },
    typed: (schema, node) => {
      const result = z.safeParse(schema, node.attributes);
      if (result.success) return result.data;
      const issue = result.error.issues[0];
      diagnostics.push({
        severity: 'error',
        message: `${nameOf(node)}: ${issue?.path.join('.') || 'its attributes'}: ${issue?.message ?? 'not read'}; left out`,
        from: node.element.from,
        to: node.element.to,
      });
      return null;
    },
  };
  return { reader, diagnostics };
};

// ---------------------------------------------------------------------------
// writing: nodes into EMF XMI (goal-controller#143)
// ---------------------------------------------------------------------------

/** A node to write, as the reader reads one back: its feature, type, id, attributes, references, children. */
export type XmiWriteNode = {
  /** the containment feature it is in (its element's name); the root's tag (`shop:Model`) */
  feature: string;
  /** its `xsi:type`, when it isn't its feature's type */
  type?: string | null;
  /** its id, in the id attribute */
  id?: string | null;
  /** its attributes; `null` and `undefined` ones aren't written */
  attributes?: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
  /**
   * Its references into the document, by feature: each the target's id
   * when it has one, else its path fragment (`//@actors.0/@goals.2`),
   * space-separated in one attribute. A target not in the document is an
   * error, and left out.
   */
  references?: Readonly<Record<string, readonly XmiWriteNode[]>>;
  /** its references into other files (`other.ecore#//X`), by feature: a child `<feature href="…"/>` each */
  hrefs?: Readonly<Record<string, readonly string[]>>;
  /** what it contains, in order */
  children?: readonly XmiWriteNode[];
  /** its text content, for a feature whose value is its element's text */
  text?: string;
};

export type XmiWriteOptions = {
  /** the attribute ids are in (default `xmi:id`; some tools key by `id`) */
  idAttribute?: string;
  /** the root's namespaces, by prefix, in order (`{ shop: 'http://example.org/shop' }`); `xmi` and `xsi` are declared first when used */
  namespaces?: Readonly<Record<string, string>>;
  /**
   * The order a node's attributes are written in (EMF writes its class's
   * features in order): these names first, in this order, after `xsi:type`;
   * the rest as given (the id first, then attributes, then references). By
   * node, when it differs by type.
   */
  order?: readonly string[] | ((node: XmiWriteNode) => readonly string[]);
  /** the root's `xmi:version` (default `2.0`); null: none, a plain XML document */
  xmiVersion?: string | null;
  /** the declaration's encoding (default `UTF-8`); `ASCII` and `ISO-8859-1` escape what they can't carry */
  encoding?: string;
  /** one level's indent (default two spaces) */
  indent?: string;
};

/** What `writeXmi` wrote, and what it couldn't. */
export type XmiWriteResult = { text: string; diagnostics: XmiDiagnostic[] };

/** An element to serialize: its name, its attributes in order, its children or text. */
export type XmlTree = {
  name: string;
  attributes: readonly (readonly [string, string])[];
  children: readonly XmlTree[];
  text?: string;
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\n': '&#xA;',
  '\r': '&#xD;',
  '\t': '&#x9;',
};

/** The highest code point an encoding carries as itself (beyond it: a character reference). */
const ceilingOf = (encoding: string): number =>
  /^(us-)?ascii$/i.test(encoding)
    ? 0x7f
    : /^iso-8859-1$|^latin-?1$/i.test(encoding)
      ? 0xff
      : Infinity;

/**
 * Elements as XML text, EMF's way: the declaration, two-space indents, an
 * empty element self-closed, attribute values escaped (`&#xA;` for a line
 * break), what the encoding can't carry as character references.
 */
export const writeXmlTree = (
  root: XmlTree,
  {
    encoding = 'UTF-8',
    indent = '  ',
  }: { encoding?: string; indent?: string } = {},
): string => {
  const ceiling = ceilingOf(encoding);
  const escape = (value: string, inAttribute: boolean) =>
    value.replace(/[&<>"\n\r\t]|[\u{80}-\u{10ffff}]/gu, (char) => {
      const code = char.codePointAt(0)!;
      if (code > ceiling) return `&#${code};`;
      if (code > 0x7f) return char;
      if (!inAttribute && (char === '"' || char === '\n' || char === '\t'))
        return char;
      return ESCAPES[char] ?? char;
    });
  const lines = [`<?xml version="1.0" encoding="${encoding}"?>`];
  const write = (element: XmlTree, depth: number) => {
    const pad = indent.repeat(depth);
    const attributes = element.attributes
      .map(([name, value]) => ` ${name}="${escape(value, true)}"`)
      .join('');
    const open = `${pad}<${element.name}${attributes}`;
    if (element.children.length) {
      lines.push(`${open}>`);
      for (const child of element.children) write(child, depth + 1);
      lines.push(`${pad}</${element.name}>`);
    } else if (element.text)
      lines.push(`${open}>${escape(element.text, false)}</${element.name}>`);
    else lines.push(`${open}/>`);
  };
  write(root, 0);
  return `${lines.join('\n')}\n`;
};

/** Attributes with those `order` names first, in its order; the rest keep their places. */
const ordered = <T extends readonly [string, string]>(
  attributes: readonly T[],
  order: readonly string[],
): T[] => {
  const rank = (name: string) => {
    const at = order.indexOf(name);
    return at < 0 ? order.length : at;
  };
  return attributes
    .map((attribute, index) => ({ attribute, index }))
    .sort(
      (a, b) =>
        rank(a.attribute[0]) - rank(b.attribute[0]) || a.index - b.index,
    )
    .map(({ attribute }) => attribute);
};

/**
 * Nodes written as EMF XMI (the reader's inverse): the root with its
 * `xmi:version` and namespaces, each node its element (its feature's name,
 * `xsi:type`, the id, attributes in the given order), references as ids or
 * path fragments, references into other files as `href` children. A
 * reference to a node not in the document is an error, and left out.
 */
export const writeXmi = (
  root: XmiWriteNode,
  {
    idAttribute = 'xmi:id',
    namespaces = {},
    order = [],
    xmiVersion = '2.0',
    encoding,
    indent,
  }: XmiWriteOptions = {},
): XmiWriteResult => {
  const diagnostics: XmiDiagnostic[] = [];
  // each node's path fragment, as the reader computes it
  const paths = new Map<XmiWriteNode, string>();
  const walk = (node: XmiWriteNode, path: string) => {
    paths.set(node, path);
    const seen = new Map<string, number>();
    for (const child of node.children ?? []) {
      const index = seen.get(child.feature) ?? 0;
      seen.set(child.feature, index + 1);
      walk(child, `${path === '/' ? '/' : path}/@${child.feature}.${index}`);
    }
  };
  walk(root, '/');
  let typed = false;
  const tree = (node: XmiWriteNode): XmlTree => {
    const given: (readonly [string, string])[] = [];
    if (node.id != null) given.push([idAttribute, node.id]);
    for (const [name, value] of Object.entries(node.attributes ?? {}))
      if (value != null) given.push([name, String(value)]);
    for (const [feature, targets] of Object.entries(node.references ?? {})) {
      const written = targets.flatMap((target) => {
        const path = paths.get(target);
        if (path === undefined) {
          diagnostics.push({
            severity: 'error',
            message: `<${node.feature}${node.id != null ? ` id="${node.id}"` : ''}>: ${feature} names a node not in the document; left out`,
          });
          return [];
        }
        return [target.id ?? path];
      });
      if (written.length) given.push([feature, written.join(' ')]);
    }
    const attributes = ordered(
      given,
      typeof order === 'function' ? order(node) : order,
    );
    if (node.type) {
      typed = true;
      attributes.unshift([XSI_TYPE, node.type]);
    }
    return {
      name: node.feature,
      attributes,
      children: [
        ...Object.entries(node.hrefs ?? {}).flatMap(([feature, hrefs]) =>
          hrefs.map((href) => ({
            name: feature,
            attributes: [['href', href] as const],
            children: [],
          })),
        ),
        ...(node.children ?? []).map(tree),
      ],
      ...(node.text !== undefined && { text: node.text }),
    };
  };
  const top = tree(root);
  const declared: (readonly [string, string])[] = [];
  const declare = (prefix: string, uri: string) => {
    if (!(prefix in namespaces)) declared.push([`xmlns:${prefix}`, uri]);
  };
  if (xmiVersion !== null) {
    declared.push(['xmi:version', xmiVersion]);
    declare('xmi', 'http://www.omg.org/XMI');
  } else if (idAttribute.startsWith('xmi:'))
    declare('xmi', 'http://www.omg.org/XMI');
  if (typed) declare('xsi', 'http://www.w3.org/2001/XMLSchema-instance');
  for (const [prefix, uri] of Object.entries(namespaces))
    declared.push([`xmlns:${prefix}`, uri]);
  return {
    text: writeXmlTree(
      { ...top, attributes: [...declared, ...top.attributes] },
      { encoding, indent },
    ),
    diagnostics,
  };
};

/**
 * An XML or XMI text in the form two are compared in: its elements and
 * text as written, each element's attributes in `order` and then by name,
 * EMF's indents, comments left out. The text as it was when it isn't XML.
 */
export const canonicalXml = (
  text: string,
  {
    order = [],
    encoding,
  }: { order?: readonly string[]; encoding?: string } = {},
): string => {
  const { root, problems } = readXml(text);
  if (!root || problems.length) return text;
  const declared = /^\s*<\?xml[^>]*\bencoding=(["'])([^"']+)\1/.exec(text)?.[2];
  const tree = (element: XmlElement): XmlTree => ({
    name: element.name,
    attributes: ordered(
      Object.entries(element.attributes).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
      order,
    ),
    children: element.children.map(tree),
    ...(element.text && { text: element.text }),
  });
  return writeXmlTree(tree(root), { encoding: encoding ?? declared });
};

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
  /** its `xsi:type` (`grl:Contribution`), or null when it has none (its feature's type) */
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
  /** the attribute ids are in (default `xmi:id`; jUCMNav keys by `id`) */
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

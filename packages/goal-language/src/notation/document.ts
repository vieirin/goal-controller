/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts
 * and properties. The syntax is the goal language's; what a line has (an id,
 * annotations, a declaration) is the definition's.
 */
import {
  ANNOTATION_KEYS,
  DECLARATION_KEYS,
  hasIds,
  type AnyDialect,
  type DefinitionContext,
  type DocumentNode,
  type DocumentTree,
} from '@goal-controller/dialect';
import {
  elementLine,
  propertyLine,
  writeAnnotations,
  writeDeclaration,
} from '../print.js';
import { parseValue } from '../parse.js';
import { annotatedProperties, readLine } from './lines.js';

type Document = Pick<
  AnyDialect,
  'elements' | 'notation' | 'propertyLineOrder' | 'indent'
>;

/**
 * Whether a node has lines of its own, with property lines and its children
 * under them: a kind the definition has, that declares nothing on its line
 * (one that does writes its properties there, and has no children). In a
 * definition with ids and `idlessElements: 'unlisted'` (GODA), its text must
 * write one: an element without (the view names it by its piStar id; TAS
 * draws Resources so) can't be named on a line.
 */
export const isListed = (
  definition: Pick<AnyDialect, 'elements' | 'idlessElements'>,
  node: DocumentNode | undefined,
): node is DocumentNode => {
  const element = node && definition.elements[node.kind];
  return (
    !!element &&
    !element.declares &&
    (node.id !== node.iStarId ||
      definition.idlessElements !== 'unlisted' ||
      !hasIds(definition))
  );
};

/** An element's line without its declaration. */
export const nodeLine = (
  definition: Pick<AnyDialect, 'elements'>,
  node: Pick<DocumentNode, 'id' | 'name' | 'notation'>,
): string => elementLine(definition, node);

/** Depth-first from the roots, each element once (at its first parent). */
export const notationDocument = (
  definition: Document,
  tree: DocumentTree,
): { text: string; ids: string[] } => {
  const lines: string[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    const node = tree.nodes.get(id);
    if (!node || seen.has(id)) return;
    const element = definition.elements[node.kind];
    const annotations = element?.annotated
      ? writeAnnotations(node.properties)
      : null;
    if (element?.declares) {
      seen.add(id);
      lines.push(
        definition.indent.repeat(depth) +
          elementLine(
            definition,
            node,
            writeDeclaration(node.properties),
            annotations,
          ),
      );
      ids.push(id);
      return;
    }
    if (!isListed(definition, node)) return;
    seen.add(id);
    lines.push(
      definition.indent.repeat(depth) +
        elementLine(definition, node, null, annotations),
    );
    ids.push(id);
    for (const key of definition.propertyLineOrder) {
      const value = node.properties[key];
      if (value !== undefined) {
        lines.push(
          definition.indent.repeat(depth + 1) + propertyLine(key, value),
        );
        ids.push(id);
      }
    }
    for (const child of node.children) visit(child, depth + 1);
  };
  for (const root of tree.roots) visit(root, 0);
  // elements no root reaches still get a line
  for (const id of tree.nodes.keys()) visit(id, 0);
  return { text: lines.join('\n'), ids };
};

export type NotationEdit =
  | { iStarId: string; text: string }
  | { iStarId: string; key: string; value: string | null };

/**
 * What a notation document changes in the model: element texts that differ,
 * and properties added, changed or removed under an element's line. Lines with
 * other ids change nothing (the editor asks to add them in the diagram); while
 * a line under an element cannot be read (being typed), that element's
 * properties are not cleared.
 */
export const notationEdits = (
  definition: Document,
  doc: string,
  tree: DocumentTree,
): NotationEdit[] => {
  const edits: NotationEdit[] = [];
  // what an element line sets: each key changed, added, or removed (unset)
  const setKeys = (
    node: DocumentNode,
    keys: readonly string[],
    read: Readonly<Record<string, string | undefined>>,
  ) => {
    for (const key of keys) {
      const value = read[key] ?? null;
      if (value !== (node.properties[key] ?? null))
        edits.push({ iStarId: node.iStarId, key, value });
    }
  };
  type Block = {
    node: DocumentNode;
    properties: Map<string, string>;
    unreadable: boolean;
  };
  const blocks: Block[] = [];
  let current: Block | null = null;
  // lines that name no element are their elements' in order: while lines are
  // added or removed (elements are, in the diagram), nothing changes
  const order = hasIds(definition)
    ? null
    : notationDocument(definition, tree).ids;
  const lines = doc.split('\n');
  if (order && lines.filter((line) => line.trim()).length !== order.length)
    return [];
  // a line with an id names its element (the id its name starts with)
  const named = order ? writtenIds(tree) : {};
  let index = 0;
  for (const written of lines) {
    const read = readLine(definition, written);
    const writtenId = read.kind === 'element' ? read.id : null;
    const position = order && written.trim() ? order[index++]! : null;
    const id = order
      ? writtenId
        ? (named[writtenId] ?? null)
        : position
      : writtenId;
    if (id && read.kind === 'element') {
      const node = tree.nodes.get(id);
      current = null;
      if (!node) continue;
      const element = definition.elements[node.kind];
      const errorBefore = (to: number) =>
        read.errors.some((error) => error.offset < to);
      // an unreadable annotation (being typed) changes none of them yet
      if (element?.annotated && !errorBefore(read.textSpan.from))
        setKeys(node, ANNOTATION_KEYS, annotatedProperties(read));
      if (element?.declares) {
        if (read.text !== nodeLine(definition, node))
          edits.push({ iStarId: node.iStarId, text: read.text });
        // an unreadable declaration (being typed) changes nothing yet
        const declaration = read.declaration;
        if (
          declaration
            ? !read.errors.some((e) => e.offset >= declaration.span.from)
            : !written.slice(read.textSpan.from).includes('{')
        )
          setKeys(node, DECLARATION_KEYS, declaration?.properties ?? {});
        continue;
      }
      if (!isListed(definition, node)) continue;
      if (read.text !== nodeLine(definition, node)) {
        edits.push({ iStarId: node.iStarId, text: read.text });
      }
      current = { node, properties: new Map(), unreadable: false };
      blocks.push(current);
      continue;
    }
    if (!current || !written.trim()) continue;
    if (
      read.kind === 'property' &&
      !read.errors.length &&
      definition.propertyLineOrder.includes(read.key)
    )
      current.properties.set(read.key, read.value);
    else current.unreadable = true;
  }
  for (const { node, properties, unreadable } of blocks) {
    for (const key of definition.propertyLineOrder) {
      const value = properties.get(key);
      const stored = node.properties[key];
      if (value !== undefined && value !== stored) {
        edits.push({ iStarId: node.iStarId, key, value });
      } else if (value === undefined && stored !== undefined && !unreadable) {
        edits.push({ iStarId: node.iStarId, key, value: null });
      }
    }
  }
  return edits;
};

/**
 * What the text is checked against: the elements the definition has (kind,
 * operand children, links, construct, custom properties) and the workbench's
 * variables. The shape a language server's context notification takes.
 */
/**
 * The elements of a tree whose names start with an id (`G1: Deliver`), by
 * that id: what a line without ids' definition names with one.
 */
export const writtenIds = (tree: DocumentTree): Record<string, string> => {
  const named: Record<string, string> = {};
  for (const [key, node] of tree.nodes) {
    const id = parseValue('annotatedName', node.name).value?.id;
    if (id && !(id in named)) named[id] = key;
  }
  return named;
};

export const contextFromView = (
  definition: Document,
  tree: DocumentTree,
  variables: readonly string[],
): DefinitionContext => ({
  elements: Object.fromEntries(
    [...tree.nodes.values()]
      .filter((node) => definition.elements[node.kind] !== undefined)
      .map((node) => [
        node.id,
        {
          kind: node.kind,
          children: node.children.filter((id) =>
            (
              (definition.notation?.operand.kinds ?? []) as readonly string[]
            ).includes(tree.nodes.get(id)?.kind ?? ''),
          ),
          relation: node.relation,
          construct: node.construct,
          ...(node.x !== undefined && { x: node.x }),
          properties: Object.fromEntries(
            Object.entries(node.properties).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string',
            ),
          ),
        },
      ]),
  ),
  variables: [...variables],
  ...(hasIds(definition)
    ? {}
    : {
        order: notationDocument(definition, tree).ids,
        named: writtenIds(tree),
      }),
});

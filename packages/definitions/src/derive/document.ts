/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts
 * and properties. Every syntax decision comes from the definition.
 */
import {
  declarationKeys,
  hasIds,
  type AnyDefinition,
  type DefinitionContext,
  type Relation,
} from '../schema';
import {
  annotationsOf,
  declarationOf,
  elementLine,
  lineId,
  propertyLine,
  readAnnotations,
  readPropertyLine,
  readDeclaration,
  splitAnnotations,
  writeAnnotations,
  writeDeclaration,
} from './lines';

/** What the document reads of a view node (goal-tree's `GoalViewNode` is one). */
export type DocumentNode = {
  iStarId: string;
  id: string;
  kind: string;
  name: string;
  notation: string | null;
  properties: Readonly<Record<string, string>>;
  children: readonly string[];
  relation?: Relation | null;
  construct?: string | null;
};

/** What the document reads of a view (goal-tree's `GoalView` is one). */
export type DocumentTree = {
  nodes: ReadonlyMap<string, DocumentNode>;
  roots: readonly string[];
};

type Document = Pick<
  AnyDefinition,
  'elements' | 'notation' | 'propertyLine' | 'propertyLineOrder' | 'indent'
>;

/**
 * Whether a node has lines of its own, with property lines and its children
 * under them: a kind the definition has, that declares nothing on its line
 * (one that does writes its properties there, and has no children).
 */
const isListed = (
  definition: Pick<AnyDefinition, 'elements'>,
  node: DocumentNode | undefined,
): node is DocumentNode => {
  const element = node && definition.elements[node.kind];
  return !!element && !element.declaration;
};

/** An element's line without its declaration. */
export const nodeLine = (
  definition: Pick<AnyDefinition, 'elements' | 'notation'>,
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
    const annotations = writeAnnotations(
      annotationsOf(definition, node.kind),
      node.properties,
    );
    const declaration = declarationOf(definition, node.kind);
    if (declaration) {
      seen.add(id);
      lines.push(
        definition.indent.repeat(depth) +
          elementLine(
            definition,
            node,
            writeDeclaration(declaration, node.properties),
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
          definition.indent.repeat(depth + 1) +
            propertyLine(definition, key, value),
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
  let index = 0;
  for (const written of lines) {
    const id = order
      ? written.trim()
        ? order[index++]!
        : null
      : lineId(definition, written);
    if (id) {
      const node = tree.nodes.get(id);
      current = null;
      if (!node) continue;
      const { groups, rest: line } = splitAnnotations(definition, written);
      const annotations = annotationsOf(definition, node.kind);
      const annotated = readAnnotations(
        annotations,
        groups.map((group) => group.text),
      );
      // an unreadable annotation (being typed) changes none of them yet
      if (!annotated.read.includes(null))
        setKeys(
          node,
          annotations.flatMap(declarationKeys),
          annotated.properties,
        );
      const declaration = declarationOf(definition, node.kind);
      if (declaration) {
        const { text, properties, declared } = readDeclaration(
          declaration,
          line,
        );
        if (text !== nodeLine(definition, node))
          edits.push({ iStarId: node.iStarId, text });
        // an unreadable declaration (being typed) changes nothing yet
        if (properties || !declared)
          setKeys(node, declarationKeys(declaration), properties ?? {});
        continue;
      }
      if (!isListed(definition, node)) continue;
      if (line.trim() !== nodeLine(definition, node)) {
        edits.push({ iStarId: node.iStarId, text: line.trim() });
      }
      current = { node, properties: new Map(), unreadable: false };
      blocks.push(current);
      continue;
    }
    if (!current || !written.trim()) continue;
    const property = readPropertyLine(definition, written);
    if (property) current.properties.set(property.key, property.value);
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
    : { order: notationDocument(definition, tree).ids }),
});

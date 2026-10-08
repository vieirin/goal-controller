/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts
 * and properties. Every syntax decision comes from the definition.
 */
import type {
  DefinitionContext,
  ElementKind,
  EngineDefinition,
  Relation,
} from '../schema';
import {
  declarationKeys,
  declarationOf,
  elementLine,
  lineId,
  propertyLine,
  readPropertyLine,
  readDeclaration,
  writeDeclaration,
} from './lines';

/** What the document reads of a view node (goal-tree's `GoalViewNode` is one). */
export type DocumentNode = {
  iStarId: string;
  id: string;
  kind: ElementKind;
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
  EngineDefinition,
  'elements' | 'notation' | 'propertyLine' | 'propertyLineOrder' | 'indent'
>;

const isNotationNode = (
  definition: Pick<EngineDefinition, 'notation'>,
  node: DocumentNode | undefined,
): node is DocumentNode =>
  node !== undefined &&
  (definition.notation.operand.kinds as readonly string[]).includes(node.kind);

/** An element's line without its declaration. */
export const nodeLine = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
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
    const declaration = declarationOf(definition, node.kind);
    if (declaration) {
      seen.add(id);
      lines.push(
        definition.indent.repeat(depth) +
          elementLine(
            definition,
            node,
            writeDeclaration(declaration, node.properties),
          ),
      );
      ids.push(id);
      return;
    }
    if (!isNotationNode(definition, node)) return;
    seen.add(id);
    lines.push(definition.indent.repeat(depth) + nodeLine(definition, node));
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
  type Block = {
    node: DocumentNode;
    properties: Map<string, string>;
    unreadable: boolean;
  };
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of doc.split('\n')) {
    const id = lineId(definition, line);
    if (id) {
      const node = tree.nodes.get(id);
      current = null;
      if (!node) continue;
      const declaration = declarationOf(definition, node.kind);
      if (declaration) {
        const { text, properties, declared } = readDeclaration(
          declaration,
          line,
        );
        if (text !== nodeLine(definition, node))
          edits.push({ iStarId: node.iStarId, text });
        // an unreadable declaration (being typed) changes nothing yet
        if (properties || !declared) {
          for (const key of declarationKeys(declaration)) {
            const value = properties?.[key] ?? null;
            if (value !== (node.properties[key] ?? null)) {
              edits.push({ iStarId: node.iStarId, key, value });
            }
          }
        }
        continue;
      }
      if (!isNotationNode(definition, node)) continue;
      if (line.trim() !== nodeLine(definition, node)) {
        edits.push({ iStarId: node.iStarId, text: line.trim() });
      }
      current = { node, properties: new Map(), unreadable: false };
      blocks.push(current);
      continue;
    }
    if (!current || !line.trim()) continue;
    const property = readPropertyLine(definition, line);
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
  definition: Pick<EngineDefinition, 'notation' | 'elements'>,
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
            isNotationNode(definition, tree.nodes.get(id)),
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
});

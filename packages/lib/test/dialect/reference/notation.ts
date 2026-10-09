// Pinned from vn/rt-langium-notation @ b61def8: packages/ui/lib/workbench/notation.ts
// (scripts/sync-reference.sh; do not edit)
/**
 * The notation view's document: the whole model as RT text, one
 * `G1: Name [G2;G3]` line per goal and task, its properties on the lines under
 * it (`maintain battery > 20`), and its resources with their declaration
 * (`R1: Battery {int 0..100 = 80}`), indented by depth (presentation only:
 * structure stays in the diagram). Text edits map back to element texts and
 * properties.
 */
import type { GoalView, GoalViewNode } from './goalView';
import type { RtContextRecord } from './context';
import {
  PROPERTY_MODES,
  RESOURCE_KEYS,
  isPropertyKey,
  propertyLine,
  readPropertyLine,
  readResourceLine,
  resourceDecl,
  type RtResourceProperties,
} from './properties';
import { composeNodeText } from './pistar';

const INDENT = '  ';
const PROPERTY_KEYS = Object.keys(PROPERTY_MODES).filter(isPropertyKey);

const isNotationNode = (node: GoalViewNode | undefined): node is GoalViewNode =>
  node?.kind === 'goal' || node?.kind === 'task';

/** An element's line without its resource declaration. */
export const nodeLine = (node: GoalViewNode): string =>
  composeNodeText(node.id, node.name, node.notation);

const resourceLine = (node: GoalViewNode): string => {
  const decl = resourceDecl(node.properties as RtResourceProperties);
  return decl ? `${nodeLine(node)} ${decl}` : nodeLine(node);
};

/** Depth-first from the roots, each element once (at its first parent). */
export const notationDocument = (
  tree: GoalView,
): { text: string; ids: string[] } => {
  const lines: string[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    const node = tree.nodes.get(id);
    if (!node || seen.has(id)) return;
    if (node.kind === 'resource') {
      seen.add(id);
      lines.push(INDENT.repeat(depth) + resourceLine(node));
      ids.push(id);
      return;
    }
    if (!isNotationNode(node)) return;
    seen.add(id);
    lines.push(INDENT.repeat(depth) + nodeLine(node));
    ids.push(id);
    for (const key of PROPERTY_KEYS) {
      const value = node.properties[key];
      if (value !== undefined) {
        lines.push(INDENT.repeat(depth + 1) + propertyLine(key, value));
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

/** The RT id a line starts with (`  G3: Name` → `G3`), if any. */
export const lineId = (line: string): string | null =>
  /^\s*([^\s:[\]]+)\s*:/.exec(line)?.[1] ?? null;

export type NotationEdit =
  | { iStarId: string; text: string }
  | { iStarId: string; key: string; value: string | null };

/**
 * What a notation document changes in the model: element texts that differ,
 * and properties added, changed or removed under an element's line. Lines with
 * other ids change nothing (the language server asks to add them in the
 * diagram); while a line under an element cannot be read (being typed), that
 * element's properties are not cleared.
 */
export const notationEdits = (doc: string, tree: GoalView): NotationEdit[] => {
  const edits: NotationEdit[] = [];
  type Block = {
    node: GoalViewNode;
    properties: Map<string, string>;
    unreadable: boolean;
  };
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of doc.split('\n')) {
    const id = lineId(line);
    if (id) {
      const node = tree.nodes.get(id);
      current = null;
      if (!node) continue;
      if (node.kind === 'resource') {
        const { text, resource } = readResourceLine(line);
        if (text !== nodeLine(node))
          edits.push({ iStarId: node.iStarId, text });
        // an unreadable declaration (being typed) changes nothing yet
        if (resource || !/\{[^}]*\}\s*$/.test(line)) {
          for (const key of RESOURCE_KEYS) {
            const value = resource?.[key] ?? null;
            if (value !== (node.properties[key] ?? null)) {
              edits.push({ iStarId: node.iStarId, key, value });
            }
          }
        }
        continue;
      }
      if (!isNotationNode(node)) continue;
      if (line.trim() !== nodeLine(node)) {
        edits.push({ iStarId: node.iStarId, text: line.trim() });
      }
      current = { node, properties: new Map(), unreadable: false };
      blocks.push(current);
      continue;
    }
    if (!current || !line.trim()) continue;
    const property = readPropertyLine(line);
    if (property) current.properties.set(property.key, property.value);
    else current.unreadable = true;
  }
  for (const { node, properties, unreadable } of blocks) {
    for (const key of PROPERTY_KEYS) {
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
 * What the language server checks the text against: the elements (kind, goal/task
 * children, links, construct, custom properties) and the workbench's variables.
 */
export const notationContext = (
  tree: GoalView,
  variables: readonly string[],
): RtContextRecord => ({
  elements: Object.fromEntries(
    [...tree.nodes.values()]
      .filter((node) => node.kind !== 'quality')
      .map((node) => [
        node.id,
        {
          kind: node.kind as 'goal' | 'task' | 'resource',
          children: node.children.filter((id) =>
            isNotationNode(tree.nodes.get(id)),
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

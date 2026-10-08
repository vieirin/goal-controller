/**
 * The notation view's document: the whole model as RT text, one
 * `G1: Name [G2;G3]` line per goal and task, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts.
 */
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import type { RtStructureRecord } from '@goal-controller/rt-language/structure';
import { composeNodeText } from './pistar';

const INDENT = '  ';

const isNotationNode = (node: GoalViewNode | undefined): node is GoalViewNode =>
  node?.kind === 'goal' || node?.kind === 'task';

export const nodeLine = (node: GoalViewNode): string =>
  composeNodeText(node.id, node.name, node.notation);

/** Depth-first from the roots, each element once (at its first parent). */
export const notationDocument = (
  tree: GoalView,
): { text: string; ids: string[] } => {
  const lines: string[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    const node = tree.nodes.get(id);
    if (!isNotationNode(node) || seen.has(id)) return;
    seen.add(id);
    lines.push(INDENT.repeat(depth) + nodeLine(node));
    ids.push(id);
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

/**
 * The element texts a notation document changes: lines whose id is an element
 * of the model and whose text differs from it. Lines with other ids change
 * nothing (the language server asks to add them in the diagram).
 */
export const notationEdits = (
  doc: string,
  tree: GoalView,
): Array<{ iStarId: string; text: string }> => {
  const edits: Array<{ iStarId: string; text: string }> = [];
  for (const line of doc.split('\n')) {
    const id = lineId(line);
    const node = id ? tree.nodes.get(id) : undefined;
    const text = line.trim();
    if (isNotationNode(node) && text !== nodeLine(node)) {
      edits.push({ iStarId: node.iStarId, text });
    }
  }
  return edits;
};

/** What the language server checks notations against: elements and their children. */
export const notationStructure = (tree: GoalView): RtStructureRecord =>
  Object.fromEntries(
    [...tree.nodes.values()]
      .filter(isNotationNode)
      .map((node) => [
        node.id,
        node.children.filter((id) => isNotationNode(tree.nodes.get(id))),
      ]),
  );

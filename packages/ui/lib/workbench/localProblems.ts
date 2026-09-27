/**
 * Problems found in the browser, as the model is edited (no round-trip):
 * JSON syntax, and notation that disagrees with the diagram.
 */
import type { TransformEngine } from '@/lib/types';
import { isValidName, jsonErrorPosition, notationIds, type ViewTree } from './pistar';
import type { Problem } from './types';

const AND_CONSTRUCTS = new Set(['sequence', 'anyOrder', 'interleaved']);

export const jsonProblem = (text: string, error: Error): Problem => {
  const position = jsonErrorPosition(text, error.message);
  return {
    severity: 'error',
    source: 'json',
    message: `The model is not valid JSON: ${error.message.replace(/\s*\(line \d+ column \d+\)/, '')}`,
    ...(position && { line: position.line, column: position.column }),
  };
};

export const treeProblems = (tree: ViewTree, engine: TransformEngine): Problem[] => {
  const problems: Problem[] = [];
  for (const node of tree.nodes.values()) {
    if (node.kind === 'resource') continue;

    if (!isValidName(node.name)) {
      problems.push({
        severity: 'warning',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: the name "${node.name}" has characters the goal notation does not allow (use letters, spaces, hyphens and apostrophes)`,
      });
    }

    if (node.kind === 'goal' && node.children.length === 0) {
      problems.push({
        severity: 'error',
        source: 'model',
        nodeId: node.id,
        message: `${node.id} has no children or tasks; every goal must be refined`,
      });
    }

    if (!node.notation || engine === 'sleec') continue;
    const listed = notationIds(node.notation);
    const notChildren = listed.filter((id) => !node.children.includes(id));
    const unlisted = listed.length > 0 ? node.children.filter((id) => {
      const child = tree.nodes.get(id);
      return child?.kind !== 'resource' && !listed.includes(id);
    }) : [];
    if (notChildren.length > 0) {
      problems.push({
        severity: 'warning',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: the notation [${node.notation}] lists ${notChildren.join(', ')}, which ${notChildren.length > 1 ? 'are not children' : 'is not a child'} of ${node.id}`,
      });
    }
    if (unlisted.length > 0) {
      problems.push({
        severity: 'warning',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: ${unlisted.join(', ')} ${unlisted.length > 1 ? 'are children' : 'is a child'} of ${node.id} but missing from its notation [${node.notation}]`,
      });
    }
    if (node.construct && node.relation) {
      const needs = AND_CONSTRUCTS.has(node.construct) ? 'and' : 'or';
      if (needs !== node.relation) {
        problems.push({
          severity: 'warning',
          source: 'model',
          nodeId: node.id,
          message: `${node.id}: [${node.notation}] needs ${needs.toUpperCase()} refinement links but ${node.id} uses ${node.relation.toUpperCase()}; the engine will ignore the notation`,
        });
      }
    }
    if (!node.construct && listed.length > 1) {
      problems.push({
        severity: 'warning',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: the notation [${node.notation}] uses no operator this engine understands`,
      });
    }
  }
  return problems;
};

/** Problems from a generation: its error and the engine's warnings. */
export const generationProblems = (
  error: string | null,
  log: string | null,
  nodeIds: Set<string>,
): Problem[] => {
  const nodeOf = (message: string): string | undefined =>
    Array.from(message.matchAll(/\b([GT]\d+[A-Za-z0-9]*)\b/g), (m) => m[1]).find(
      (id): id is string => !!id && nodeIds.has(id),
    );
  const problems: Problem[] = [];
  if (error) {
    problems.push({ severity: 'error', source: 'generation', message: error, nodeId: nodeOf(error) });
  }
  for (const line of (log ?? '').split('\n')) {
    const warning = /\[WARNING\]\s*(.*)/.exec(line);
    if (!warning?.[1]) continue;
    const message = warning[1].trim();
    // unset task probabilities are expected until the variables are filled in
    const severity = /using default achievability/.test(message) ? 'info' : 'warning';
    problems.push({ severity, source: 'generation', message, nodeId: nodeOf(message) });
  }
  return problems;
};

/**
 * Problems found in the browser, as the model is edited (no round-trip):
 * JSON syntax, and notation that disagrees with the diagram.
 */
import type { GoalView } from '@goal-controller/goal-tree';
import type { TransformEngine } from '@/lib/types';
import { isValidName, jsonErrorPosition } from './pistar';
import type { Problem } from './types';
import { relationMismatch } from '@goal-controller/rt-language/constructs';

/**
 * RT id mentioned in an engine/generation message, if any.
 * Prefers explicit "for node X" / "(node X)" over the first G/T/R id (dependsOn
 * messages name the dependency first).
 */
export const nodeIdInMessage = (message: string): string | undefined => {
  const marked =
    /\(node ([GTR]\d+[A-Za-z0-9]*)\)/.exec(message)?.[1] ??
    /\bfor node ([GTR]\d+[A-Za-z0-9]*)\b/.exec(message)?.[1];
  if (marked) return marked;
  return /\b([GTR]\d+[A-Za-z0-9]*)\b/.exec(message)?.[1];
};

export const jsonProblem = (text: string, error: Error): Problem => {
  const position = jsonErrorPosition(text, error.message);
  return {
    severity: 'error',
    source: 'json',
    message: `The model is not valid JSON: ${error.message.replace(/\s*\(line \d+ column \d+\)/, '')}`,
    ...(position && { line: position.line, column: position.column }),
  };
};

export const treeProblems = (
  tree: GoalView,
  engine: TransformEngine,
): Problem[] => {
  const problems: Problem[] = [];
  for (const node of tree.nodes.values()) {
    // a Quality that only qualifies is not read by the engines (no RT id needed)
    if (node.kind === 'quality' && !node.parent && node.children.length === 0)
      continue;
    // the view falls back to the piStar id when the text has no RT id
    if (node.id === node.iStarId) {
      problems.push({
        severity: 'error',
        source: 'model',
        // the view keys an element without an RT id by its piStar id: selectable all the same
        nodeId: node.id,
        message: `"${node.text.trim()}" has no id: start its name with one (G…, T… or R…), e.g. "G4: ${node.name || 'name'}"`,
      });
      continue;
    }
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
    // read by the engine's RT grammar when building the view tree
    if (node.notationError) {
      problems.push({
        severity: 'warning',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: the notation [${node.notation}] is not valid for this engine (${node.notationError})`,
      });
      continue;
    }
    const listed = node.order;
    const notChildren = listed.filter((id) => !node.children.includes(id));
    const unlisted =
      listed.length > 0
        ? node.children.filter((id) => {
            const child = tree.nodes.get(id);
            // an element without an RT id has its own "has no id" problem
            return (
              child?.kind !== 'resource' &&
              child?.id !== child?.iStarId &&
              !listed.includes(id)
            );
          })
        : [];
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
    const mismatch = relationMismatch(node.construct, node.relation);
    if (mismatch) {
      problems.push({
        severity: 'error',
        source: 'model',
        nodeId: node.id,
        message: `${node.id}: [${node.notation}] ${mismatch}`,
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
  const nodeOf = (message: string): string | undefined => {
    const marked = nodeIdInMessage(message);
    return marked && nodeIds.has(marked) ? marked : undefined;
  };
  const problems: Problem[] = [];
  if (error) {
    // the message; the server's stack trace (if any) stays in the Log
    const message =
      error
        .split('\n')
        .filter((line) => !/^\s*(at |Error: )/.test(line))[0]
        ?.trim() || error;
    problems.push({
      severity: 'error',
      source: 'generation',
      message,
      nodeId: nodeOf(message),
    });
  }
  for (const line of (log ?? '').split('\n')) {
    const warning = /\[WARNING\]\s*(.*)/.exec(line);
    if (!warning?.[1]) continue;
    const message = warning[1].trim();
    // unset task probabilities are expected until the variables are filled in
    const severity = /using default achievability/.test(message)
      ? 'info'
      : 'warning';
    problems.push({
      severity,
      source: 'generation',
      message,
      nodeId: nodeOf(message),
    });
  }
  return problems;
};

/**
 * Internal tree traversal utilities
 */
import type { TraversalNode, TraversalParent } from '../types/';

/**
 * Get all children of a node including tasks and resources
 */
export function childrenWithTasksAndResources(
  node: TraversalParent,
): TraversalNode[] {
  const result: TraversalNode[] = [];

  // Add children if they exist (goals only)
  if (node.children) {
    result.push(...node.children);
  }

  // Add tasks if they exist (goals and tasks)
  if (node.tasks) {
    result.push(...node.tasks);
  }

  // Add resources if they exist (tasks only)
  if (node.resources) {
    result.push(...node.resources);
  }

  return result;
}

/**
 * Every node of a type in the trees, each once, by id: callers type the
 * result by their nodes (`GoalTree.allByType`).
 */
export function allByType(
  gm: readonly TraversalNode[],
  type: string,
): TraversalNode[] {
  const allCurrent = gm
    .flatMap((node): TraversalNode[] => {
      const children: TraversalNode[] =
        node.type === 'resource'
          ? []
          : childrenWithTasksAndResources(node as TraversalParent);
      if (children.length > 0) {
        return [node, ...allByType(children, type)];
      }
      return [node];
    })
    .filter((node) => node.type === type)
    .sort((a, b) => a.id.localeCompare(b.id))
    .reduce<Record<string, TraversalNode>>((acc, current) => {
      if (acc[current.id]) {
        return { ...acc };
      }
      return { ...acc, [current.id]: current };
    }, {});

  return Object.values(allCurrent);
}

export function allGoalsMap(
  gm: readonly TraversalNode[],
): Map<string, TraversalNode> {
  return new Map(allByType(gm, 'goal').map((goal) => [goal.id, goal]));
}

export function leafGoals(gm: readonly TraversalNode[]): TraversalNode[] {
  return allByType(gm, 'goal').filter((goal) => !!goal.tasks);
}

/** Children whose `properties.engine.maxRetries` is greater than zero. */
export function childrenWithMaxRetries(
  node: TraversalParent & { type: 'goal' },
): TraversalNode[] {
  return childrenWithTasksAndResources(node).filter((child) => {
    if (child.type === 'resource') return false;
    const engine = child.properties?.engine as
      | { maxRetries?: number }
      | undefined;
    return (engine?.maxRetries ?? 0) > 0;
  });
}

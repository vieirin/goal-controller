/**
 * Internal tree traversal utilities
 */
import type {
  GoalNode,
  GoalTree,
  Resource,
  Task,
  TraversalNode,
  TraversalParent,
  TreeNode,
  Type,
} from '../types/';

/**
 * Get all children of a node including tasks and resources
 */
export function childrenWithTasksAndResources(
  node: TraversalParent,
): TraversalNode[] {
  const result: TraversalNode[] = [];

  // Add children if they exist (GoalNode types only)
  if (node.children) {
    result.push(...node.children);
  }

  // Add tasks if they exist (GoalNode and Task types)
  if (node.tasks) {
    result.push(...node.tasks);
  }

  // Add resources if they exist (Task types)
  if (node.resources) {
    result.push(...node.resources);
  }

  return result;
}

// Overloads for type-specific returns
export function allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  type: 'goal',
): GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>[];
export function allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  type: 'task',
): Task<TTaskEngine, TResourceEngine>[];
export function allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  type: 'resource',
): Resource<TResourceEngine>[];
export function allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  type: Type,
): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[];
export function allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  type: Type,
): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[] {
  const allCurrent = gm
    .flatMap((node) => {
      const children: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[] =
        node.type === 'resource'
          ? []
          : (childrenWithTasksAndResources(node as TraversalParent) as TreeNode<
              TGoalEngine,
              TTaskEngine,
              TResourceEngine
            >[]);
      if (children.length > 0) {
        return [node, ...(allByType(children, type) ?? [])];
      }
      return [node];
    })
    .filter((node) => node.type === type)
    .sort((a, b) => a.id.localeCompare(b.id))
    .reduce<
      Record<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>
    >((acc, current) => {
      if (acc[current.id]) {
        return { ...acc };
      }
      return { ...acc, [current.id]: current };
    }, {});

  return Object.values(allCurrent);
}

export function allGoalsMap<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
): Map<string, GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
  return new Map(allByType(gm, 'goal').map((goal) => [goal.id, goal]));
}

export function leafGoals<TGoalEngine, TTaskEngine, TResourceEngine>(
  gm: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
): GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>[] {
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

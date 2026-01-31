/**
 * Internal tree traversal utilities
 */
import type {
  GoalNode,
  GoalTree,
  Resource,
  Task,
  TreeNode,
  Type,
} from '../types/';

/**
 * Get all children of a node including tasks and resources
 */
export function childrenWithTasksAndResources<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
>(
  node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>,
): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[] {
  const result: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[] = [];

  // Resources have no children
  if (node.type === 'resource') {
    return result;
  }

  // Add children if they exist (GoalNode types only)
  if ('children' in node && node.children) {
    result.push(...node.children);
  }

  // Add tasks if they exist (GoalNode and Task types)
  if ('tasks' in node && node.tasks) {
    result.push(...node.tasks);
  }

  // Add resources if they exist (Task types)
  if ('resources' in node && node.resources) {
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
      const children = childrenWithTasksAndResources(node);
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

/**
 * Get children with max retries > 0
 * Note: This requires the engine props to have a maxRetries field
 */
export function childrenWithMaxRetries<
  TGoalEngine extends { maxRetries: number },
  TTaskEngine extends { maxRetries: number },
  TResourceEngine,
>(
  node: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>,
): Array<
  | GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
  | Task<TTaskEngine, TResourceEngine>
> {
  return childrenWithTasksAndResources(node).filter(
    (
      child,
    ): child is
      | GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
      | Task<TTaskEngine, TResourceEngine> => {
      if (child.type === 'resource') return false;
      return child.properties.engine.maxRetries > 0;
    },
  );
}

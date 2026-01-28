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
export function childrenWithTasksAndResources(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];

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
export function allByType(gm: GoalTree, type: 'goal'): GoalNode[];
export function allByType(gm: GoalTree, type: 'task'): Task[];
export function allByType(gm: GoalTree, type: 'resource'): Resource[];
export function allByType(gm: GoalTree, type: Type): TreeNode[];
export function allByType(gm: GoalTree, type: Type): TreeNode[] {
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
    .reduce<Record<string, TreeNode>>((acc, current) => {
      if (acc[current.id]) {
        return { ...acc };
      }
      return { ...acc, [current.id]: current };
    }, {});

  return Object.values(allCurrent);
}

export function allGoalsMap(gm: GoalTree): Map<string, GoalNode> {
  return new Map(allByType(gm, 'goal').map((goal) => [goal.id, goal]));
}

export function leafGoals(gm: GoalTree): GoalNode[] {
  return allByType(gm, 'goal').filter((goal) => !!goal.tasks);
}

export function childrenWithMaxRetries(node: GoalNode): Array<GoalNode | Task> {
  return childrenWithTasksAndResources(node).filter(
    (child): child is GoalNode | Task => {
      if (child.type === 'resource') return false;
      return child.properties.edge.maxRetries > 0;
    },
  );
}

import type {
  GoalNode,
  GoalTree,
  Resource,
  Task,
  TreeNode,
  Type,
} from './types/';

// Overloads for type-specific returns
export function allByType({
  gm,
  type,
}: {
  gm: GoalTree;
  type: 'goal';
}): GoalNode[];
export function allByType({ gm, type }: { gm: GoalTree; type: 'task' }): Task[];
export function allByType({
  gm,
  type,
}: {
  gm: GoalTree;
  type: 'resource';
}): Resource[];
// Implementation signature for internal recursive calls
export function allByType({
  gm,
  type,
}: {
  gm: GoalTree;
  type: Type;
}): TreeNode[];
export function allByType({
  gm,
  type,
}: {
  gm: GoalTree;
  type: Type;
}): TreeNode[] {
  const allCurrent = gm
    .flatMap((node) => {
      // we need to make resources and tasks back as children so we can
      // filter them out in the next step
      const children = childrenWithTasksAndResources({ node });
      if (children.length > 0) {
        return [node, ...(allByType({ gm: children, type }) ?? [])];
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

export const allGoalsMap = ({
  gm,
}: {
  gm: GoalTree;
}): Map<string, GoalNode> => {
  return new Map(
    allByType({ gm, type: 'goal' }).map((goal) => [goal.id, goal]),
  );
};

export const goalRootId = ({ id }: { id: string }): string => {
  return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
};

export const leafGoals = ({ gm }: { gm: GoalTree }): GoalNode[] => {
  const leaves = allByType({ gm, type: 'goal' })?.filter(
    (goal) => !!goal.tasks,
  );
  return leaves;
};

export function* cartesianProduct<T>(...arrays: T[][]): Generator<T[]> {
  if (arrays.length === 0) {
    yield [];
    return;
  }

  const [first, ...rest] = arrays;
  if (!first) {
    yield [];
    return;
  }
  for (const item of first) {
    if (rest.length === 0) {
      yield [item];
    } else {
      for (const subProduct of cartesianProduct(...rest)) {
        yield [item, ...subProduct];
      }
    }
  }
}

export function childrenWithTasksAndResources({
  node,
}: {
  node: TreeNode;
}): TreeNode[] {
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

export function childrenLength({ node }: { node: TreeNode }): number {
  return childrenWithTasksAndResources({ node }).length;
}

export function childrenWithMaxRetries({
  node,
}: {
  node: GoalNode;
}): Array<GoalNode | Task> {
  return childrenWithTasksAndResources({ node }).filter(
    (child): child is GoalNode | Task => {
      // Resources don't have maxRetries
      if (child.type === 'resource') return false;
      // Both goals and tasks have maxRetries in properties.edge
      return child.properties.edge.maxRetries > 0;
    },
  );
}

export function dumpTreeToJSON({ gm }: { gm: GoalTree }): string {
  return JSON.stringify(gm, null, 2);
}

export function childrenIncludingTasks({
  node,
}: {
  node: GoalNode | Task;
}): TreeNode[] {
  return childrenWithTasksAndResources({ node });
}

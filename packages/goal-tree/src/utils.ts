import type {
  GenericGoal,
  GenericTree,
  GenericTreeNode,
  GoalNode,
  Resource,
  Task,
  TreeNode,
  Type,
} from './types/';

// Overloads for type-specific returns
export function allByType<T extends GenericTree>({
  gm,
  type,
  preferVariant,
}: {
  gm: T;
  type: 'goal';
  preferVariant?: boolean;
}): GoalNode[];
export function allByType<T extends GenericTree>({
  gm,
  type,
  preferVariant,
}: {
  gm: T;
  type: 'task';
  preferVariant?: boolean;
}): Task[];
export function allByType<T extends GenericTree>({
  gm,
  type,
  preferVariant,
}: {
  gm: T;
  type: 'resource';
  preferVariant?: boolean;
}): Resource[];
// Implementation signature for internal recursive calls
export function allByType({
  gm,
  type,
  preferVariant,
}: {
  gm: GenericTree;
  type: Type;
  preferVariant?: boolean;
}): GenericTreeNode[];
export function allByType<T extends GenericTree>({
  gm,
  type,
  preferVariant = true,
}: {
  gm: T;
  type: Type;
  preferVariant?: boolean;
}): GenericTreeNode[] {
  const allCurrent = gm
    .flatMap((node) => {
      // we need to make resources and tasks back as children so we can
      // filter them out in the next step
      const children = childrenWithTasksAndResources({ node });
      if (children.length > 0) {
        return [
          node,
          ...(allByType({ gm: children, type, preferVariant }) ?? []),
        ];
      }

      return [node];
    })
    .filter((node) => node.type === type)
    .sort((a, b) => a.id.localeCompare(b.id))
    .reduce<Record<string, GenericTreeNode>>((acc, current) => {
      if (acc[current.id]) {
        // Only goals have variantOf
        if (preferVariant && 'variantOf' in current && current.variantOf) {
          return { ...acc, [current.id]: current };
        }
        return { ...acc };
      }

      return { ...acc, [current.id]: current };
    }, {});

  return Object.values(allCurrent);
}

export const allGoalsMap = <T extends GenericTree>({
  gm,
  preferVariant = true,
}: {
  gm: T;
  preferVariant?: boolean;
}): Map<string, GoalNode> => {
  return new Map(
    allByType({ gm, type: 'goal', preferVariant }).map((goal) => [
      goal.id,
      goal,
    ]),
  );
};

export const goalRootId = ({ id }: { id: string }): string => {
  return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
};

export const leafGoals = <T extends GenericTree>({ gm }: { gm: T }): T => {
  const leaves = allByType({ gm, type: 'goal' })?.filter(
    (goal) => !!goal.tasks,
  );
  return leaves as T;
};

export const isVariant = ({ variantOf }: GoalNode): boolean => !!variantOf;

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
  node: GenericTreeNode;
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

export function childrenLength({ node }: { node: GenericTreeNode }): number {
  return childrenWithTasksAndResources({ node }).length;
}

export function childrenWithMaxRetries({
  node,
}: {
  node: GenericGoal;
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

export function dumpTreeToJSON({ gm }: { gm: GenericTree }): string {
  return JSON.stringify(gm, null, 2);
}

export function childrenIncludingTasks({
  node,
}: {
  node: GenericGoal | Task;
}): TreeNode[] {
  return childrenWithTasksAndResources({ node });
}

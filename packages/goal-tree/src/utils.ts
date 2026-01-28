import type {
  GenericGoal,
  GenericTree,
  GoalNode,
  Resource,
  Task,
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
export function allByType<T extends GenericTree>({
  gm,
  type,
  preferVariant = true,
}: {
  gm: T;
  type: Type;
  preferVariant?: boolean;
}): any {
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
    .reduce<Record<string, T[number]>>((acc, current) => {
      if (acc[current.id]) {
        if (preferVariant && current.variantOf) {
          return { ...acc, [current.id]: current };
        }
        return { ...acc };
      }

      return { ...acc, [current.id]: current };
    }, {});

  return Object.values(allCurrent) as T;
}

export const allGoalsMap = <T extends GenericTree>({
  gm,
  preferVariant = true,
}: {
  gm: T;
  preferVariant?: boolean;
}): Map<string, T[number]> => {
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

export function childrenWithTasksAndResources<T extends GenericGoal>({
  node,
}: {
  node: T;
}): any[] {
  const result: any[] = [];

  // Add children if they exist (GoalNode types)
  if ('children' in node && node.children) {
    result.push(...node.children);
  }

  // Add resources if they exist (GoalNode only, since tasks have resources but shouldn't be traversed here)
  if ('resources' in node && node.type === 'goal') {
    result.push(...node.resources);
  }

  // Add tasks if they exist (GoalNode types)
  if ('tasks' in node && node.tasks) {
    result.push(...node.tasks);
  }

  return result;
}

export function childrenLength({ node }: { node: GenericGoal }): number {
  return childrenWithTasksAndResources({ node }).length;
}

export function childrenWithMaxRetries({
  node,
}: {
  node: GenericGoal;
}): GenericGoal[] {
  return childrenWithTasksAndResources({ node }).filter(
    (child) => !!child.properties.maxRetries,
  );
}

export function dumpTreeToJSON({ gm }: { gm: GenericTree }): string {
  return JSON.stringify(gm, null, 2);
}

export function childrenIncludingTasks<T extends GenericGoal>({
  node,
}: {
  node: T;
}): T[] {
  return childrenWithTasksAndResources({ node });
}

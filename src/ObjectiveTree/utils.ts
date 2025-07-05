import { GenericGoal, GenericTree, GoalNode, Type } from './types';

export const allByType = <T extends GenericTree>({
  gm,
  type,
  preferVariant = true,
}: {
  gm: T;
  type: Type;
  preferVariant?: boolean;
}): T => {
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
    .reduce(
      (acc, current) => {
        if (acc[current.id]) {
          if (preferVariant && current.variantOf) {
            return { ...acc, [current.id]: current };
          }
          return { ...acc };
        }

        return { ...acc, [current.id]: current };
      },
      {} as Record<string, T[number]>
    );

  return Object.values(allCurrent) as T;
};

export const allGoalsMap = <T extends GenericTree>({
  gm,
  preferVariant = true,
}: {
  gm: T;
  preferVariant?: boolean;
}) => {
  return new Map(
    allByType({ gm, type: 'goal', preferVariant }).map((goal) => [
      goal.id,
      goal,
    ])
  );
};

export const goalRootId = ({ id }: { id: string }) => {
  return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
};

export const leafGoals = <T extends GenericTree>({ gm }: { gm: T }) => {
  const leaves = allByType({ gm, type: 'goal' })?.filter(
    (goal) => !!goal.tasks
  );
  return leaves;
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
    }
    for (const subProduct of cartesianProduct(...rest)) {
      yield [item, ...subProduct];
    }
  }
}

export function childrenWithTasksAndResources<T extends GenericGoal>({
  node,
}: {
  node: T;
}) {
  return [
    ...(node.children ?? []),
    ...node.resources,
    ...(node.tasks ?? []),
  ] as T[];
}

export function childrenLength({ node }: { node: GenericGoal }) {
  return childrenWithTasksAndResources({ node }).length;
}

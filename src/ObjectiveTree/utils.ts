import { GoalNode, GoalTree, GoalTreeWithParent, Type } from './types';

export const allByType = <T extends GoalTreeWithParent | GoalTree>({
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
      if ((node.children?.length || 0) > 0) {
        return [
          node,
          ...(allByType({ gm: node.children as T, type, preferVariant }) ?? []),
        ];
      }

      return [node];
    })
    .filter((node) => node.type === type)
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

export const allGoalsMap = <T extends GoalTreeWithParent | GoalTree>({
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

export const leafGoals = <T extends GoalTreeWithParent | GoalTree>({
  gm,
}: {
  gm: T;
}) => {
  const leaves = allByType({ gm, type: 'goal' })?.filter(
    (goal) => !goal.children?.length
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
  for (const item of first) {
    if (rest.length === 0) {
      yield [item];
    }
    for (const subProduct of cartesianProduct(...rest)) {
      yield [item, ...subProduct];
    }
  }
}

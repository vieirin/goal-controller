import { GoalNode, GoalTree } from './types';

export const allGoalsList = ({
  gm,
  preferVariant = true,
}: {
  gm: GoalTree | undefined;
  preferVariant?: boolean;
}) => {
  const all = gm?.flatMap((node): GoalNode[] => {
    if (node.children?.length) {
      const children = node.children;
      return [node, ...(allGoalsList({ gm: children, preferVariant }) ?? [])];
    }
    return [node];
  });

  const unique = Object.values(
    all?.reduce(
      (acc, current) => {
        if (acc[current.id]) {
          if (preferVariant && current.variantOf) {
            return { ...acc, [current.id]: current };
          }
          return { ...acc };
        }

        return { ...acc, [current.id]: current };
      },
      {} as Record<string, GoalNode>
    ) ?? {}
  );

  return unique;
};

export const allGoalsMap = ({
  gm,
  preferVariant = true,
}: {
  gm: GoalTree | undefined;
  preferVariant?: boolean;
}) => {
  return new Map(
    allGoalsList({ gm, preferVariant }).map((goal) => [goal.id, goal])
  );
};

export const goalRootId = ({ id }: { id: string }) => {
  return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
};

export const leafGoals = ({ gm }: { gm: GoalTree | undefined }) => {
  const leaves = allGoalsList({ gm })?.filter((goal) => !goal.children?.length);
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

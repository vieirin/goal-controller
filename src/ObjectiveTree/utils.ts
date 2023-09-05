import { GoalNode, GoalTree } from './types';

const allGoals = ({
  gm,
  preferVariant = true,
}: {
  gm: GoalTree | undefined;
  preferVariant?: boolean;
}) => {
  const all = gm?.flatMap((node): GoalNode[] => {
    if (node.children?.length) {
      const children = node.children;
      return [node, ...(allGoals({ gm: children, preferVariant }) ?? [])];
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

export const goalRootId = ({ id }: { id: string }) => id.slice(0, 2);

export const leafGoals = ({ gm }: { gm: GoalTree | undefined }) => {
  const leaves = allGoals({ gm })?.filter((goal) => !goal.children?.length);
  return leaves;
};

import { GoalNode, GoalTree } from './types';

const allGoals = ({ gm }: { gm: GoalTree | undefined }) => {
  const all = gm?.flatMap((node): GoalNode[] => {
    if (node.children?.length) {
      const children = node.children;
      return [node, ...(allGoals({ gm: children }) ?? [])];
    }
    return [node];
  });

  const unique = [...new Map(all?.map((item) => [item['id'], item])).values()];
  return unique;
};

export const leafGoals = ({ gm }: { gm: GoalTree | undefined }) => {
  const leaves = allGoals({ gm })?.filter((goal) => !goal.children?.length);
  return leaves;
};

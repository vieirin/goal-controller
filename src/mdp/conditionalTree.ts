import { resolveDependency } from '../GoalTree/dependencyResolver';
import { GoalTree } from '../GoalTree/types';
import { GrouppedGoals } from './common';

export const conditionalTree = ({
  grouppedGoals,
  gm,
}: {
  grouppedGoals: GrouppedGoals;
  gm: GoalTree;
}) => {
  return Object.values(grouppedGoals).map((variants) =>
    variants.map((variant) => resolveDependency({ gm, goal: variant }))
  );
};

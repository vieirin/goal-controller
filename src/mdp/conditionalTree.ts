import { resolveDependency } from '../GoalTree/dependencyResolver';
import type { GoalTree } from '../GoalTree/types';
import type { GrouppedGoals } from './common';

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

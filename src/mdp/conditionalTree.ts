import { resolveDependency } from '../ObjectiveTree/dependencyResolver';
import { GoalTree } from '../ObjectiveTree/types';
import { GrouppedGoals } from './common';

export const conditionalTree = ({
  grouppedGoals,
  gm,
}: {
  grouppedGoals: GrouppedGoals;
  gm: GoalTree;
}) => {
  return Object.values(grouppedGoals).flatMap((variants) =>
    variants.map((variant) => resolveDependency({ gm, goal: variant }))
  );
};

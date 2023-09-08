import { resolveDependency } from '../ObjectiveTree/dependencyResolver';
import { GoalTree } from '../ObjectiveTree/types';
import { leavesGrouppedGoals } from './common';

export const conditionalTree = ({ gm }: { gm: GoalTree }) => {
  const grouppedGoals = leavesGrouppedGoals({ gm });

  return Object.values(grouppedGoals).map((variants) =>
    variants.map((variant) => resolveDependency({ gm, goal: variant }))
  );
};

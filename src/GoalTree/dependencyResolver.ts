import { GoalNode, GoalTree } from './types';
import { allGoalsMap } from './utils';

type GoalId = string;
export type Dependency = {
  goal: string;
  isFormula?: boolean;
  depends: Array<Dependency | null>;
};
const resolve = ({
  allMap,
  target,
}: {
  allMap: Map<string, GoalNode>;
  target: GoalId;
}): Dependency | null => {
  const targetDependency = allMap.get(target);
  if (!targetDependency) {
    return null;
  }
  const isFormula = (targetDependency.children?.length ?? 0) > 0;
  const dependencies = targetDependency.properties.dependsOn;
  return {
    goal: targetDependency.id,
    isFormula,
    depends: dependencies.map((dependency) =>
      resolve({
        allMap,
        target: dependency,
      })
    ),
  };
};

export type ConditionDependency = Dependency & { isVariant: boolean };
export const resolveDependency = ({
  gm,
  goal,
}: {
  gm: GoalTree;
  goal: GoalNode;
}): ConditionDependency => {
  const allGoals = allGoalsMap({ gm });
  const dependencies = goal.properties.dependsOn;

  return {
    goal: goal.id,
    isVariant: !!goal.variantOf,
    depends: dependencies.map((dependency) =>
      resolve({
        allMap: allGoals,
        target: dependency,
      })
    ),
  };
};

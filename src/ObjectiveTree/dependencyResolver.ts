import { GoalNode, GoalTree } from './types';
import { allGoalsMap } from './utils';

type GoalId = string;
type Dependency = {
  goal: string;
  isFormula?: boolean;
  depends: Dependency | null;
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

  return {
    goal: targetDependency.id,
    isFormula,
    depends: resolve({
      allMap,
      target: targetDependency.customProperties.dependsOn,
    }),
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
  return {
    goal: goal.id,
    isVariant: !!goal.variantOf,
    depends: resolve({
      allMap: allGoals,
      target: goal.customProperties.dependsOn,
    }),
  };
};

import type {
  ConditionDependency,
  Dependency,
} from '../../GoalTree/dependencyResolver';
import type { Relation } from '../../GoalTree/types';
import {
  achieved,
  formulaForGoal,
  greaterThan,
  not,
  parenthesis,
  pursued,
  separator,
} from '../common';

const _dependency = ({
  depends,
  negateItems,
  sep,
}: {
  depends: Dependency;
  negateItems: boolean;
  sep: Relation;
}) => {
  if (!depends) {
    return '';
  }

  if (depends.isFormula) {
    return formulaForGoal(depends.goal);
  }

  const { goal } = depends;
  return parenthesis(
    [achieved(goal), greaterThan(pursued(goal), 0)]
      .map((item) => (negateItems ? not(item) : item))
      .join(separator(sep)),
  );
};

export const dependency = ({
  condition: { depends },
  negateItems,
  sep,
}: {
  condition: ConditionDependency;
  negateItems: boolean;
  sep: Relation;
}) => {
  const dep = depends
    .filter((d): d is Dependency => Boolean(d))
    .map((dep) => _dependency({ depends: dep, negateItems, sep }));

  const joinedDep = dep.join(separator('and'));

  return dep.length > 1 ? parenthesis(joinedDep) : joinedDep;
};

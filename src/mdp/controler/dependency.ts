import { ConditionDependency } from '../../ObjectiveTree/dependencyResolver';
import { Relation } from '../../ObjectiveTree/types';
import {
  achieved,
  formulaForGoal,
  not,
  parenthesis,
  pursued,
  separator,
} from '../common';

export const dependency = ({
  condition,
  negateItems,
  sep,
}: {
  condition: ConditionDependency;
  negateItems: boolean;
  sep: Relation;
}) => {
  const { depends } = condition;
  if (!depends) {
    return '';
  }

  if (depends.isFormula) {
    return formulaForGoal(depends.goal);
  }

  const { goal } = depends;
  return parenthesis(
    [achieved(goal), pursued(goal)]
      .map((item) => (negateItems ? not(item) : item))
      .join(separator(sep))
  );
};

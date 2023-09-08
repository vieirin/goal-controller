import { ConditionDependency } from '../../ObjectiveTree/dependencyResolver';
import { Relation } from '../../ObjectiveTree/types';
import {
  achieved,
  formulaForGoal,
  greaterThan,
  not,
  parenthesis,
  pursued,
  separator,
} from '../common';

export const dependency = ({
  condition: { depends },
  negateItems,
  sep,
}: {
  condition: ConditionDependency;
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
      .join(separator(sep))
  );
};

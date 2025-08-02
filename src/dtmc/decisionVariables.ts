import { GoalNode, GoalTree } from '../ObjectiveTree/types';
import { allByType, cartesianProduct } from '../ObjectiveTree/utils';

// each decision variable is a tuple of values containing name:space
// we need to generate all possible combinations of these tuples
// and then generate a variable for each combination
// if the space for a variable t is 9, for example, we generate 10 variables:
// decision_G0_0, decision_G0_1, ..., decision_G0_9
// if we have two variables t and s, we generate 10*2=20 variables:
// decision_G0_0_0, decision_G0_0_1, ..., decision_G0_9_1
export const decisionVariablesForGoal = ({ goal }: { goal: GoalNode }) => {
  const spaceArray = goal.decisionVars.map((decision) =>
    Array.from({ length: decision.space }, (_, i) => i)
  );
  const variableArray = goal.decisionVars.map((decision) => decision.variable);

  const decisionVars = cartesianProduct(...spaceArray);
  return [variableArray, decisionVars] as const;
};

export const decisionVariableName = (
  goalId: string,
  variableCombination: number[],
  vars: string[]
) => {
  return `decision_${goalId}_${variableCombination
    .map((v, i) => `${vars[i]}${v}`)
    .join('_')}`;
};

export const decisionVariablesTemplate = ({ gm }: { gm: GoalTree }) => {
  const decisionVariables: string[] = [];
  const allGoals = allByType({ gm, type: 'goal' });
  allGoals.forEach((goal) => {
    if (!goal.decisionVars.length) {
      return;
    }
    const [vars, decisionVars] = decisionVariablesForGoal({ goal });
    for (const variableCombination of decisionVars) {
      const variable = `const int ${decisionVariableName(
        goal.id,
        variableCombination,
        vars
      )};`;
      decisionVariables.push(variable);
    }
  });

  return decisionVariables.join('\n');
};

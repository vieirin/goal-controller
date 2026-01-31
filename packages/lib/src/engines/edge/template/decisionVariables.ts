import { GoalTree, cartesianProduct } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree } from '../types';
import { getLogger } from '../logger/logger';

// each decision variable is a tuple of values containing name:space
// we need to generate all possible combinations of these tuples
// and then generate a variable for each combination
// if the space for a variable t is 9, for example, we generate 10 variables:
// decision_G0_0, decision_G0_1, ..., decision_G0_9
// if we have two variables t and s, we generate 10*2=20 variables:
// decision_G0_0_0, decision_G0_0_1, ..., decision_G0_9_1
export const decisionVariablesForGoal = ({
  goal,
}: {
  goal: EdgeGoalNode;
}): readonly [string[], Generator<number[]>, number[][]] => {
  const spaceArray = goal.properties.engine.decision.decisionVars.map(
    (decision: { variable: string; space: number }) =>
      Array.from({ length: decision.space }, (_, i) => i),
  );
  const variableArray = goal.properties.engine.decision.decisionVars.map(
    (decision: { variable: string; space: number }) => decision.variable,
  );

  const decisionVars = cartesianProduct<number>(...spaceArray);
  return [variableArray, decisionVars, spaceArray] as const;
};

export const decisionVariableName = (
  goalId: string,
  variableCombination: number[],
  vars: string[],
): string => {
  return `decision_${goalId}_${variableCombination
    .map((v, i) => `${vars[i]}${v}`)
    .join('_')}`;
};

export const decisionVariablesTemplate = ({
  gm,
}: {
  gm: EdgeGoalTree;
}): string => {
  if (!process.env.EXPERIMENTAL_DECISION_VARIABLES) {
    return '';
  }
  const logger = getLogger();
  const decisionVariables: string[] = [];
  const allGoals = GoalTree.allByType(gm, 'goal');

  const goalsWithDecisionVariables = allGoals.filter(
    (goal) => goal.properties.engine.decision.decisionVars.length,
  );
  goalsWithDecisionVariables.forEach((goal) => {
    const [vars, decisionVars, spaceArray] = decisionVariablesForGoal({ goal });

    spaceArray.forEach((space, i) => {
      const varName = vars[i];
      if (!varName) {
        throw new Error(
          `Variable at index ${i} is undefined for goal ${goal.id}`,
        );
      }
      logger.decisionVariable([varName, space.length]);
    });

    for (const variableCombination of decisionVars) {
      const variable = `const int ${decisionVariableName(
        goal.id,
        variableCombination,
        vars,
      )};`;
      decisionVariables.push(variable);
    }
  });

  return decisionVariables.join('\n');
};

import {
  achieved,
  pursue,
  pursued,
  separator,
  skip,
} from '../../../mdp/common';
import {
  GoalNode,
  GoalNodeWithParent,
  GoalTreeWithParent,
} from '../../../ObjectiveTree/types';
import { allByType, childrenLength } from '../../../ObjectiveTree/utils';
import {
  decisionVariableName,
  decisionVariablesForGoal,
} from '../../decisionVariables';
import { goalModule } from './goalModule';

const declareManagerVariables = ({
  goals,
}: {
  goals: GoalNodeWithParent[];
}) => {
  return [
    ...goals.map(
      (goal) =>
        `  ${pursued(goal.id)} : [0..${childrenLength({ node: goal })}] init 0;`
    ),
  ].join('\n');
};

// we're gonna have an entry for each decision combination
// for instance, if we have decision variables for time, we'll have
// an entry for each time value
// we need to map each variable in the combination to the corresponding decision variable
// for instance, decision_G0_0_1 should be mapped to `t=0 & s=1`
const variableStatement = (
  variableArray: string[],
  variableCombination: number[]
) => {
  return variableArray
    .map((decisionVarName, i) => `${decisionVarName}=${variableCombination[i]}`)
    .join(separator('and'));
};

// What to do when there's a variant
const declareGoalTransitionsWithDecisionVariable = ({
  goal,
  goalIndex,
}: {
  goal: GoalNode;
  goalIndex: number;
}) => {
  const [variableArray, decisionVars] = decisionVariablesForGoal({ goal });
  const decisionVarArray = Array.from(decisionVars);

  // [pursueG0] turn=0 & goal=0
  const pursuePrefix = `[${pursue(goal.id)}] turn=0 & goal=${goalIndex}`;

  // (G0_pursued'=1) & (goal'=1);
  const transitionResult = `(${pursued(goal.id)}'=1) & (goal'=${
    goalIndex + 1
  });`;

  const pursueStatements = decisionVarArray.map((variableCombination) => {
    // time=0 & space=1
    const varStatement = variableStatement(variableArray, variableCombination);

    // decision_G0_0_1
    const decisionVariable = decisionVariableName(goal.id, variableCombination);

    // G1_achieved=0
    // expand to many children
    const childrenAchieved = achieved(goal.children?.[0]?.id ?? '');

    return `  ${pursuePrefix} & ${pursued(
      goal.id
    )}=0 & ${childrenAchieved}=0 & ${decisionVariable}=1 & ${varStatement} -> ${transitionResult}`;
  });

  const skipStatements = decisionVarArray.map((variableCombination) => {
    const decisionVariable = decisionVariableName(goal.id, variableCombination);
    const varStatement = variableStatement(variableArray, variableCombination);
    return `  [${skip(goal.id)}] turn=0 & goal=${goalIndex} & ${pursued(
      goal.id
    )}=0 & ${decisionVariable}=0 & ${varStatement} -> true;`;
  });

  return [...pursueStatements, '', ...skipStatements].join('\n');
};

export const goalNumberId = (goalId: string) => {
  const id = goalId.match(/\d+/)?.[0];
  if (!id) {
    throw new Error(
      `The goal id must follow the pattern 'G%d', got: '${goalId}'`
    );
  }
  return id;
};

export const goalModules = ({ gm }: { gm: GoalTreeWithParent }) => {
  const goals = allByType({ gm, type: 'goal' });
  return `
${goals
  .sort(
    (a, b) => Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0])
  )
  .map(goalModule)
  .join('\n\n')}
`;
};

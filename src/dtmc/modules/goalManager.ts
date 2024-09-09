import { Dictionary } from 'lodash';
import {
  achieved,
  grouppedGoals,
  pursue,
  pursued,
  skip,
} from '../../mdp/common';
import { GoalNode, GoalTree } from '../../ObjectiveTree/types';
import {
  decisionVariableName,
  decisionVariablesForGoal,
} from '../decisionVariables';

const declareManagerVariables = ({
  goals,
}: {
  goals: Dictionary<GoalNode[]>;
}) => {
  const childrenLength = (goal: string) => goals[goal].length;
  return Object.keys(goals)
    .map((goal) => `  ${pursued(goal)} : [0..${childrenLength(goal)}] init 0;`)
    .join('\n');
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
    .join(' & ');
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
  const transitionResult = `(${pursued(goal.id)}'=1) & (goal'=${goalIndex + 1});`;

  const pursueStatements = decisionVarArray.map((variableCombination) => {
    // time=0 & space=1
    const varStatement = variableStatement(variableArray, variableCombination);

    // decision_G0_0_1
    const decisionVariable = decisionVariableName(goal.id, variableCombination);

    // G1_achieved=0
    const childrenAchieved = achieved(goal.children?.[0].id ?? '');

    return ` ${pursuePrefix} & ${pursued(goal.id)}=0 & ${childrenAchieved}=0 & ${decisionVariable}=1 & ${varStatement} -> ${transitionResult}`;
  });

  const skipStatements = decisionVarArray.map((variableCombination) => {
    const decisionVariable = decisionVariableName(goal.id, variableCombination);
    const varStatement = variableStatement(variableArray, variableCombination);
    return `  [${skip(goal.id)}] turn=0 & goal=${goalIndex} & ${pursued(goal.id)}=0 & ${decisionVariable}=0 & ${varStatement} -> true;`;
  });

  return [...pursueStatements, '', ...skipStatements].join('\n');
};
/*
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_0=1 & time=0 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_1=1 & time=1 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_2=1 & time=2 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_3=1 & time=3 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_4=1 & time=4 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_5=1 & time=5 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_6=1 & time=6 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_7=1 & time=7 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_8=1 & time=8 -> (G0_pursued'=1) & (goal'=1);
  [pursueG0] turn=0 & goal=0 & G0_pursued=0 & G1_achieved=0 & decision_G0_9=1 & time=9 -> (G0_pursued'=1) & (goal'=1);

  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_0=0 & time=0 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_1=0 & time=1 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_2=0 & time=2 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_3=0 & time=3 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_4=0 & time=4 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_5=0 & time=5 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_6=0 & time=6 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_7=0 & time=7 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_8=0 & time=8 -> true;
  [skipG0] turn=0 & goal=0 & G0_pursued=0 & decision_G0_9=0 & time=9 -> true;
  [achievedG0] turn=0 & goal=0 -> true; */

const declareManagerTransitions = ({
  goals,
}: {
  goals: Dictionary<GoalNode[]>;
}) => {
  return Object.keys(goals).map((goal, index) => {
    const fatherGoalForGroup = goals[goal].find((g) => g.id === goal);
    if (fatherGoalForGroup?.hasDecision) {
      return declareGoalTransitionsWithDecisionVariable({
        goal: fatherGoalForGroup,
        goalIndex: index,
      });
    }
    return '';
  });
};

export const goalManagerTemplate = ({ gm }: { gm: GoalTree }) => {
  const goals = grouppedGoals({ gm });
  const goalsLength = Object.keys(goals).length;
  return `
module GoalManager
  goal : [0..${goalsLength - 1}] init 0;
${declareManagerVariables({ goals })}

${declareManagerTransitions({ goals })}
`;
};

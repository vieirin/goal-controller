import { Dictionary } from 'lodash';
import {
  achieved,
  grouppedGoals,
  not,
  parenthesis,
  pursue,
  pursued,
  pursueThrough,
  separator,
  skip,
} from '../../mdp/common';
import { GoalNode, GoalTree, Relation } from '../../ObjectiveTree/types';
import {
  decisionVariableName,
  decisionVariablesForGoal,
} from '../decisionVariables';

const choosableGoals = (goals: Dictionary<GoalNode[]>) => {
  const goalsWithChoice = Object.values(goals).reduce((acc, goal) => {
    goal.forEach((g) => {
      // return only unique choice goals
      if (g.customProperties.uniqueChoice) {
        acc.push(g);
      }
    });
    return acc;
  }, [] as GoalNode[]);
  return goalsWithChoice;
};

const declareManagerVariables = ({
  goals,
}: {
  goals: Dictionary<GoalNode[]>;
}) => {
  const childrenLength = (parentId: string, goalGroup: GoalNode[]) =>
    goalGroup.find((g) => g.id === parentId)?.children?.length ?? 1;
  const goalsWithChoice = choosableGoals(goals);
  return [
    ...Object.entries(goals).map(
      ([goalId, goals]) =>
        `  ${pursued(goalId)} : [0..${childrenLength(goalId, goals)}] init 0;`
    ),
    ...goalsWithChoice.map(
      (goal) =>
        `  ${goal.id}_chosen : [0..${goal.children?.length ?? 1}] init 0;`
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
  const transitionResult = `(${pursued(goal.id)}'=1) & (goal'=${goalIndex + 1});`;

  const pursueStatements = decisionVarArray.map((variableCombination) => {
    // time=0 & space=1
    const varStatement = variableStatement(variableArray, variableCombination);

    // decision_G0_0_1
    const decisionVariable = decisionVariableName(goal.id, variableCombination);

    // G1_achieved=0
    // expand to many children
    const childrenAchieved = achieved(goal.children?.[0].id ?? '');

    return `  ${pursuePrefix} & ${pursued(goal.id)}=0 & ${childrenAchieved}=0 & ${decisionVariable}=1 & ${varStatement} -> ${transitionResult}`;
  });

  const skipStatements = decisionVarArray.map((variableCombination) => {
    const decisionVariable = decisionVariableName(goal.id, variableCombination);
    const varStatement = variableStatement(variableArray, variableCombination);
    return `  [${skip(goal.id)}] turn=0 & goal=${goalIndex} & ${pursued(goal.id)}=0 & ${decisionVariable}=0 & ${varStatement} -> true;`;
  });

  return [...pursueStatements, '', ...skipStatements].join('\n');
};

const childrenAchieved = (children: GoalNode[]) => {
  return parenthesis(
    children.map((child) => `${achieved(child.id)}>0`).join(separator('and'))
  );
};

const childrenNotAchieved = (children: GoalNode[]) => {
  return not(childrenAchieved(children));
};

const anyChildrenAchieved = (children: GoalNode[]) => {
  return parenthesis(
    children.map((child) => `${achieved(child.id)}>0`).join(separator('or'))
  );
};

const childrenSkipCondition = (children: GoalNode[], relation: Relation) => {
  switch (relation) {
    case 'or':
      return anyChildrenAchieved(children);
    case 'and':
      return childrenNotAchieved(children);
    case 'none':
      throw new Error(
        'Expected an and/or relation between children but found none'
      );
  }
};

const goalNumberId = (goalId: string) => {
  const id = goalId.match(/\d+/)?.[0];
  if (!id) {
    throw new Error(
      `The goal id must follow the pattern 'G%d', got: '${goalId}'`
    );
  }
  return id;
};

/*
  //G1
  [pursueG1_2] turn=0 & goal=1 & G1_pursued=0 & G2_achieved=0 -> (G1_pursued'=1) & (goal'=2);
  [pursueG1_3] turn=0 & goal=1 & G1_pursued=0 & G3_achieved=0 -> (G1_pursued'=2) & (goal'=3);
  [skipG1] turn=0 & goal=1 & G1_pursued=0 & !(G2_achieved>0 & G3_achieved>0) -> (goal'=0) & (G0_pursued'=0);
  [achievedG1] turn=0 & goal=1 -> (goal'=0);
*/
const declareGoalTransitionsWithChildren = ({
  goal,
}: {
  goal: GoalNode & { relationToChildren: Relation };
}) => {
  const children = goal.children ?? [];
  const goalIndex = goalNumberId(goal.id);

  const childrenPursueTransitions = children.map((child, index) => {
    const childIndex = goalNumberId(child.id);

    const transition = `  [${pursueThrough(goal.id, child.id)}] turn=0 & goal=${goalIndex} & ${pursued(goal.id)}=0 & ${achieved(child.id)}=0 -> (${pursued(goal.id)}'=${index + 1}) & (goal'=${childIndex});`;
    return transition;
  });
  const skipTransition = `  [${skip(goal.id)}] turn=0 & goal=${goalIndex} & ${pursued(goal.id)}=0 & ${childrenSkipCondition(children, goal.relationToChildren)} -> (goal'=0) & (${pursued(goal.id)}'=0);`;

  return ['', ...childrenPursueTransitions, skipTransition].join('\n');
};

const declareManagerTransitions = ({
  goals,
}: {
  goals: Dictionary<GoalNode[]>;
}) => {
  return Object.keys(goals)
    .map((goal, index) => {
      const parentGoalForGroup = goals[goal].find((g) => g.id === goal);
      if (parentGoalForGroup?.hasDecision) {
        return declareGoalTransitionsWithDecisionVariable({
          goal: parentGoalForGroup,
          goalIndex: index,
        });
      }
      if (parentGoalForGroup?.customProperties.uniqueChoice) {
        return '';
      }

      const relationToChildren = parentGoalForGroup?.relationToChildren;
      if (parentGoalForGroup?.children?.length && relationToChildren) {
        // ensure relationToChildren is not null
        return declareGoalTransitionsWithChildren({
          goal: { ...parentGoalForGroup, relationToChildren },
        });
      }
      return '';
    })
    .filter((l) => l)
    .join('\n');
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
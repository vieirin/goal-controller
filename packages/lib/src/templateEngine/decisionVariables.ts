import type { GoalNode, GoalTree } from '../GoalTree/types';
import { allByType, cartesianProduct } from '../GoalTree/utils';
import { getLogger } from '../logger/logger';

// Default achievability discretization space (values 0-3)
export const DEFAULT_ACHIEVABILITY_SPACE = 4;

// Return type for decisionVariablesForGoal
export type DecisionVariablesResult = {
  variableNames: string[]; // decision variable names (e.g., ['t', 'loc'])
  combinations: Generator<number[]>; // cartesian product of all spaces (achievability + decision vars)
  decisionSpaces: number[][]; // space arrays for decision vars
  childGoalIds: string[]; // child goal IDs (e.g., ['G5', 'G6'])
  achievabilitySpaces: number[][]; // achievability space arrays (e.g., [[0,1,2,3], [0,1,2,3]])
};

// each decision variable is a tuple of values containing name:space
// we need to generate all possible combinations of these tuples
// and then generate a variable for each combination
// if the space for a variable t is 9, for example, we generate 10 variables:
// decision_G0_0, decision_G0_1, ..., decision_G0_9
// if we have two variables t and s, we generate 10*2=20 variables:
// decision_G0_0_0, decision_G0_0_1, ..., decision_G0_9_1
// Now also includes achievability discretization for each child goal:
// decision_G0_achievabilityG1_0_achievabilityG2_0_t0_loc0
export const decisionVariablesForGoal = ({
  goal,
  achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
}: {
  goal: GoalNode;
  achievabilitySpace?: number;
}): DecisionVariablesResult => {
  // Decision variable spaces
  const decisionSpaces = goal.decisionVars.map((decision) =>
    Array.from({ length: decision.space }, (_, i) => i),
  );
  const variableNames = goal.decisionVars.map((decision) => decision.variable);

  // Child goal achievability spaces
  const childGoalIds = (goal.children ?? []).map((child) => child.id);
  const achievabilitySpaces = childGoalIds.map(() =>
    Array.from({ length: achievabilitySpace }, (_, i) => i),
  );

  // Combine: achievability spaces first, then decision variable spaces
  const allSpaces = [...achievabilitySpaces, ...decisionSpaces];
  const combinations = cartesianProduct(...allSpaces);

  return {
    variableNames,
    combinations,
    decisionSpaces,
    childGoalIds,
    achievabilitySpaces,
  };
};

export const decisionVariableName = (
  goalId: string,
  variableCombination: number[],
  vars: string[],
  childGoalIds: string[] = [],
  achievabilityValues: number[] = [],
): string => {
  // Build achievability part: achievabilityG5_0_achievabilityG6_1
  const achievabilityPart = childGoalIds
    .map((childId, i) => `achievability${childId}_${achievabilityValues[i]}`)
    .join('_');

  // Build decision vars part: t0_loc2
  const decisionVarsPart = variableCombination
    .map((v, i) => `${vars[i]}${v}`)
    .join('_');

  // Combine: decision_G2_achievabilityG5_0_achievabilityG6_1_t0_loc2
  const parts = [`decision_${goalId}`];
  if (achievabilityPart) {
    parts.push(achievabilityPart);
  }
  if (decisionVarsPart) {
    parts.push(decisionVarsPart);
  }

  return parts.join('_');
};

// Check if a goal has decision variables or children for achievability discretization
const hasDecisionSpace = (goal: GoalNode): boolean => {
  const hasDecisionVars = goal.decisionVars.length > 0;
  const hasChildren = (goal.children?.length ?? 0) > 0;
  return hasDecisionVars || hasChildren;
};

export const decisionVariablesTemplate = ({
  gm,
  enabled = true,
  achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
}: {
  gm: GoalTree;
  enabled?: boolean;
  achievabilitySpace?: number;
}): string => {
  if (!enabled) {
    return '';
  }

  const logger = getLogger();
  const decisionVariables: string[] = [];
  const allGoals = allByType({ gm, type: 'goal' });

  // Include goals with decision variables OR children (for achievability discretization)
  const goalsWithDecisionSpace = allGoals.filter(hasDecisionSpace);

  goalsWithDecisionSpace.forEach((goal) => {
    const {
      variableNames,
      combinations,
      decisionSpaces,
      childGoalIds,
      achievabilitySpaces,
    } = decisionVariablesForGoal({ goal, achievabilitySpace });

    // Log decision variable spaces
    decisionSpaces.forEach((space, i) => {
      const varName = variableNames[i];
      if (!varName) {
        throw new Error(
          `Variable at index ${i} is undefined for goal ${goal.id}`,
        );
      }
      logger.decisionVariable([varName, space.length]);
    });

    // Log achievability spaces
    achievabilitySpaces.forEach((space, i) => {
      const childId = childGoalIds[i];
      if (childId) {
        logger.decisionVariable([`achievability${childId}`, space.length]);
      }
    });

    const numAchievabilityVars = childGoalIds.length;

    for (const combination of combinations) {
      // Split combination: first N values are achievability, rest are decision vars
      const achievabilityValues = combination.slice(0, numAchievabilityVars);
      const decisionVarValues = combination.slice(numAchievabilityVars);

      const variable = `const int ${decisionVariableName(
        goal.id,
        decisionVarValues,
        variableNames,
        childGoalIds,
        achievabilityValues,
      )};`;
      decisionVariables.push(variable);
    }
  });

  return decisionVariables.join('\n');
};

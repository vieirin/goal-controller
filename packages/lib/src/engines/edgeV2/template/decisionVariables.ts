import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree } from '../types';
import { getLogger } from '../logger/logger';

// Kept for template API compatibility; v2 decision vars are no longer discretized by achievability space
export const DEFAULT_ACHIEVABILITY_SPACE = 4;

export const decisionVariableName = (goalId: string): string =>
  `decision_${goalId}`;

/** Child-selection const `_decision_G<id>` — used by OR joints and AND anyOrder. */
export const selectionDecisionVariableName = (goalId: string): string =>
  `_decision_${goalId}`;

const isOrGoal = (goal: EdgeGoalNode): boolean =>
  goal.relationToChildren === 'or';

const isAnyOrderAndGoal = (goal: EdgeGoalNode): boolean =>
  goal.relationToChildren === 'and' &&
  goal.properties.engine.executionDetail?.type === 'anyOrder';

/** Decision vars for a goal: always decision_G<id>; OR and AND+anyOrder also get _decision_G<id>. */
export const decisionVariableNamesForGoal = (goal: EdgeGoalNode): string[] => {
  const names = [decisionVariableName(goal.id)];
  if (isOrGoal(goal) || isAnyOrderAndGoal(goal)) {
    names.push(selectionDecisionVariableName(goal.id));
  }
  return names;
};

export const decisionVariablesTemplate = ({
  gm,
  enabled = true,
}: {
  gm: EdgeGoalTree;
  enabled?: boolean;
  /** @deprecated Unused in edgeV2; kept for call-site compatibility */
  achievabilitySpace?: number;
}): string => {
  if (!enabled) {
    return '';
  }

  const logger = getLogger();
  const decisionVariables: string[] = [];
  const allGoals = GoalTree.allByType(gm, 'goal');

  allGoals.forEach((goal) => {
    const names = decisionVariableNamesForGoal(goal);
    names.forEach((name) => {
      logger.decisionVariable([name, 1]);
      decisionVariables.push(`const int ${name};`);
    });
  });

  return decisionVariables.join('\n');
};

import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import type { EdgeGoalNode } from '../../../../types';
import { chosenVariable, decisionVariable } from '../../../common';
import { DEFAULT_EDGE_V2_DECISION_UPPER } from '../../../decisionConstants';

const goalStateVariable = (goalId: string): string => `${goalId}_state`;

export type GoalModuleVariablesOptions = {
  /** Inclusive max for `decision_<goalId> : [0..N]` */
  decisionUpperBound?: number;
};

const degradationFailedUpperBound = (goal: EdgeGoalNode): number => {
  const retryMap =
    goal.properties.engine.executionDetail?.type === 'degradation'
      ? goal.properties.engine.executionDetail.retryMap
      : undefined;

  if (retryMap) {
    const retryValues = Object.values(retryMap).filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value > 0,
    );
    if (retryValues.length > 0) {
      return Math.max(...retryValues);
    }
  }

  // Fallback when degradation exists without explicit retry map value.
  return goal.properties.engine.maxRetries > 0
    ? goal.properties.engine.maxRetries
    : 1;
};

export const variablesDefinition = (
  goal: EdgeGoalNode,
  options?: GoalModuleVariablesOptions,
): string => {
  const logger = getLogger();
  const defineVariable = (variable: string, upperBound: number): string => {
    logger.variableDefinition({
      variable,
      upperBound,
      initialValue: 0,
      type: 'int',
      context: 'goal',
    });
    return `${variable} : [0..${upperBound}] init 0;`;
  };
  const stateVariableStatement = defineVariable(goalStateVariable(goal.id), 1);

  const decisionUpperBound =
    options?.decisionUpperBound ?? DEFAULT_EDGE_V2_DECISION_UPPER;
  const decisionVariableStatement = defineVariable(
    decisionVariable(goal.id),
    decisionUpperBound,
  );

  const pursueableChildrenCount = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  ).length;
  const chosenVariableStatement =
    goal.properties.engine.executionDetail?.type === 'choice' &&
    pursueableChildrenCount > 0
      ? defineVariable(chosenVariable(goal.id), pursueableChildrenCount)
      : null;

  const failedVariableStatement =
    goal.properties.engine.executionDetail?.type === 'degradation'
      ? defineVariable(failed(goal.id), degradationFailedUpperBound(goal))
      : null;

  return [
    stateVariableStatement,
    decisionVariableStatement,
    chosenVariableStatement,
    failedVariableStatement,
  ]
    .filter(Boolean)
    .join('\n  ');
};

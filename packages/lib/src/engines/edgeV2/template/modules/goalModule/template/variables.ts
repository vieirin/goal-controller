import type { EdgeGoalNode } from '../../../../types';
import { construct, orderedChildIds, retriedChildren } from './children';
import { getLogger } from '../../../../logger/logger';
import {
  chosenVariable,
  goalFailedVariable,
  stateVariable,
} from '../../../../template/common';

export const variablesDefinition = (goal: EdgeGoalNode): string => {
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

  const stateVariableStatement = defineVariable(stateVariable(goal.id), 1);

  const chosenVariableStatement =
    construct(goal) === 'choice'
      ? defineVariable(chosenVariable(goal.id), orderedChildIds(goal).length)
      : null;

  // degradation: one retry counter per retried child (notation @n or maxRetries)
  const retries = retriedChildren(goal);
  const maxRetriesVariableStatement =
    retries.length > 0
      ? retries
          .map(({ id, retries: max }) => defineVariable(goalFailedVariable(id), max))
          .join('\n  ')
      : null;

  return [stateVariableStatement, chosenVariableStatement, maxRetriesVariableStatement]
    .filter(Boolean)
    .join('\n  ');
};

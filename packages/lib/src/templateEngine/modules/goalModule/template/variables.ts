import type { GoalNode } from '../../../../GoalTree/types';
import * as utils from '../../../../GoalTree/utils';
import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import {
  achievedVariable,
  chosenVariable,
  pursuedVariable,
} from '../../../common';

export const variablesDefinition = (goal: GoalNode): string => {
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
  const pursuedVariableStatement = defineVariable(pursuedVariable(goal.id), 1);
  const achievedVariableStatement = !goal.execCondition?.maintain
    ? defineVariable(achievedVariable(goal.id), 1)
    : null;

  const children = utils.childrenIncludingTasks({ node: goal });
  const chosenVariableStatement =
    goal.executionDetail?.type === 'choice'
      ? defineVariable(chosenVariable(goal.id), children.length)
      : null;

  const childrenWithMaxRetries = utils.childrenWithMaxRetries({ node: goal });
  const maxRetriesVariableStatement =
    childrenWithMaxRetries.length > 0
      ? childrenWithMaxRetries
          .map((child) => {
            const maxRetries = child.properties.maxRetries;
            if (maxRetries === undefined) {
              throw new Error(
                `Child ${child.id} is expected to have maxRetries but it is undefined`,
              );
            }
            return defineVariable(failed(child.id), maxRetries);
          })
          .join('\n')
      : null;

  return [
    pursuedVariableStatement,
    achievedVariableStatement,
    chosenVariableStatement,
    maxRetriesVariableStatement,
  ]
    .filter(Boolean)
    .join('\n  ');
};

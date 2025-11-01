import { GoalNodeWithParent } from '../../../../GoalTree/types';
import * as utils from '../../../../GoalTree/utils';
import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import {
  achievedVariable,
  chosenVariable,
  pursuedVariable,
} from '../../../common';

export const variablesDefinition = (goal: GoalNodeWithParent) => {
  const logger = getLogger();
  const defineVariable = (variable: string, upperBound: number) => {
    logger.variableDefinition({
      variable,
      upperBound,
      initialValue: 0,
      type: 'int',
    });
    return `${variable} : [0..${upperBound}] init 0;`;
  };

  const pursuedVariableStatement = defineVariable(pursuedVariable(goal.id), 1);
  const achievedVariableStatement = !goal.execCondition?.maintain
    ? defineVariable(achievedVariable(goal.id), 1)
    : null;

  const chosenVariableStatement =
    goal.executionDetail?.type === 'choice'
      ? defineVariable(chosenVariable(goal.id), 1)
      : null;

  const childrenWithMaxRetries = utils.childrenWithMaxRetries({ node: goal });
  const maxRetriesVariableStatement =
    childrenWithMaxRetries.length > 0
      ? childrenWithMaxRetries
          .map((child) =>
            defineVariable(failed(child.id), child.customProperties.maxRetries!)
          )
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

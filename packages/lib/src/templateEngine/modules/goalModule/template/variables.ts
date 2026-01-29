import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode } from '../../../edgeTypes';
import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import {
  achievedVariable,
  chosenVariable,
  pursuedVariable,
} from '../../../common';

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
  const pursuedVariableStatement = defineVariable(pursuedVariable(goal.id), 1);
  const achievedVariableStatement = !goal.properties.engine.execCondition
    ?.maintain
    ? defineVariable(achievedVariable(goal.id), 1)
    : null;

  const children = Node.children(goal);
  const chosenVariableStatement =
    goal.properties.engine.executionDetail?.type === 'choice'
      ? defineVariable(chosenVariable(goal.id), children.length)
      : null;

  const childrenWithMaxRetries = Node.childrenWithRetries(goal);
  const maxRetriesVariableStatement =
    childrenWithMaxRetries.length > 0
      ? childrenWithMaxRetries
          .map((child) => {
            const maxRetries = child.properties.engine.maxRetries;
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

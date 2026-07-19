import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
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

  const pursueableChildren = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  );
  const isOrChoice =
    goal.relationToChildren === 'or' &&
    goal.properties.engine.executionDetail?.type === 'choice';
  const chosenVariableStatement =
    isOrChoice && pursueableChildren.length > 0
      ? defineVariable(chosenVariable(goal.id), pursueableChildren.length)
      : null;

  const isDegradation =
    goal.properties.engine.executionDetail?.type === 'degradation';
  const childrenWithMaxRetries = isDegradation
    ? Node.childrenWithRetries(goal)
    : [];
  const maxRetriesVariableStatement =
    childrenWithMaxRetries.length > 0
      ? childrenWithMaxRetries
          .map((child: EdgeGoalNode | EdgeTask) => {
            const maxRetries = child.properties.engine.maxRetries;
            return defineVariable(goalFailedVariable(child.id), maxRetries);
          })
          .join('\n  ')
      : null;

  return [stateVariableStatement, chosenVariableStatement, maxRetriesVariableStatement]
    .filter(Boolean)
    .join('\n  ');
};

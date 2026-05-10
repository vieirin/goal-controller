import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
import { coercePositiveIntRetry } from '../../../../retryCoercion';
import { chosenVariable } from '../../../common';
import { pursueableChildren } from '../../../prismGuards';

const goalStateVariable = (goalId: string): string => `${goalId}_state`;

/** Retry cap N for degradation pursue lines (`sibling_failed < N` / `= N`), or null if absent from retryMap. */
export const degradationRetryCapFromMap = (
  goal: EdgeGoalNode,
  childId: string,
): number | null => {
  if (goal.relationToChildren !== 'or') return null;
  const ed = goal.properties.engine.executionDetail;
  if (ed?.type !== 'degradation') return null;
  return coercePositiveIntRetry(ed.retryMap?.[childId]);
};

/**
 * Ordered list of `{ child, cap }` for every pursueable child in an OR
 * degradation goal whose retryMap entry has a positive integer cap.
 * Single source of truth for pursue, skip, and validator expected counts.
 */
export const cappedDegradationChildren = (
  goal: EdgeGoalNode,
): Array<{ child: EdgeGoalNode | EdgeTask; cap: number }> => {
  if (goal.relationToChildren !== 'or') return [];
  const ed = goal.properties.engine.executionDetail;
  if (ed?.type !== 'degradation') return [];
  return pursueableChildren(goal).flatMap((child) => {
    const cap = coercePositiveIntRetry(ed.retryMap?.[child.id]);
    return cap !== null ? [{ child, cap }] : [];
  });
};

const degradationSiblingFailedVariableLines = (
  goal: EdgeGoalNode,
  defineVariable: (variable: string, upperBound: number) => string,
): string[] => {
  return cappedDegradationChildren(goal).map(({ child, cap }) =>
    defineVariable(failed(child.id), cap),
  );
};

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
  const stateVariableStatement = defineVariable(goalStateVariable(goal.id), 1);

  const pursueableChildrenCount = pursueableChildren(goal).length;
  const chosenVariableStatement =
    goal.properties.engine.executionDetail?.type === 'choice' &&
    pursueableChildrenCount > 0
      ? defineVariable(chosenVariable(goal.id), pursueableChildrenCount)
      : null;

  const degradationFailedLines = degradationSiblingFailedVariableLines(
    goal,
    defineVariable,
  );

  return [
    stateVariableStatement,
    chosenVariableStatement,
    ...degradationFailedLines,
  ]
    .filter(Boolean)
    .join('\n  ');
};

import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../logger/logger';
import { failed } from '../../../../mdp/common';
import type { EdgeGoalNode } from '../../../../types';
import { coercePositiveIntRetry } from '../../../../retryCoercion';
import { chosenVariable } from '../../../common';

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

const degradationSiblingFailedVariableLines = (
  goal: EdgeGoalNode,
  defineVariable: (variable: string, upperBound: number) => string,
): string[] => {
  if (goal.relationToChildren !== 'or') return [];
  const ed = goal.properties.engine.executionDetail;
  if (ed?.type !== 'degradation') return [];
  const pursueableIds = new Set(
    Node.children(goal)
      .filter((c) => !Node.isResource(c))
      .map((c) => c.id),
  );
  const lines: string[] = [];
  const retryMap = ed.retryMap;
  if (!retryMap) return lines;
  for (const [siblingId, raw] of Object.entries(retryMap)) {
    if (!pursueableIds.has(siblingId)) continue;
    const cap = coercePositiveIntRetry(raw);
    if (cap === null) continue;
    lines.push(defineVariable(failed(siblingId), cap));
  }
  return lines;
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

  const pursueableChildrenCount = Node.children(goal).filter(
    (child) => !Node.isResource(child),
  ).length;
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

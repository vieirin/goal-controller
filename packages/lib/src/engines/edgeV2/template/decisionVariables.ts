import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree } from '../types';
import { getLogger } from '../logger/logger';
import { DEFAULT_DISCRETISATION, DISCRETISATION_CONSTANT } from './common';
import {
  orderedChildIds,
  usesChildSelection,
} from './modules/goalModule/template/children';

// Kept for template API compatibility; edgeV2 uses `discretisation` (N) instead
export const DEFAULT_ACHIEVABILITY_SPACE = 4;

export const decisionVariableName = (nodeId: string): string =>
  `decision_${nodeId}`;

/** Child-selection const `_decision_G<childId>` — one per child of a goal that picks one child by relative achievability. */
export const selectionDecisionVariableName = (childId: string): string =>
  `_decision_${childId}`;

/** Decision vars for a goal: always decision_G<id>; child-selecting goals also get one _decision_G<childId> per child. */
export const decisionVariableNamesForGoal = (goal: EdgeGoalNode): string[] => {
  const names = [decisionVariableName(goal.id)];
  if (usesChildSelection(goal)) {
    names.push(...orderedChildIds(goal).map(selectionDecisionVariableName));
  }
  return names;
};

/**
 * EDGE reference preamble:
 *   const int N=<discretisation>;
 *   const int decision_G0;  const int _decision_G0;  const int decision_T1; ...
 * Decision thresholds are left undefined: they are the controller's choices.
 */
export const decisionVariablesTemplate = ({
  gm,
  enabled = true,
  discretisation = DEFAULT_DISCRETISATION,
}: {
  gm: EdgeGoalTree;
  enabled?: boolean;
  discretisation?: number;
}): string => {
  if (!Number.isInteger(discretisation) || discretisation <= 0) {
    throw new Error(
      `[INVALID OPTION]: discretisation must be a positive integer, got ${discretisation}`,
    );
  }
  const scale = `const int ${DISCRETISATION_CONSTANT} = ${discretisation};`;
  if (!enabled) {
    return scale;
  }

  const logger = getLogger();
  const names = [
    ...GoalTree.allByType(gm, 'goal').flatMap(decisionVariableNamesForGoal),
    ...GoalTree.allByType(gm, 'task').map((task) =>
      decisionVariableName(task.id),
    ),
  ];
  names.forEach((name) => {
    logger.decisionVariable([name, discretisation]);
  });

  return [scale, ...names.map((name) => `const int ${name};`)].join('\n');
};

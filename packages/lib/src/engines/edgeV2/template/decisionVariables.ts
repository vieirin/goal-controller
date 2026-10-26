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
 *
 * With `evolvable` on (and `enabled`), each is instead an EvoChecker evolvable
 * parameter with the discretisation's literal value as its upper bound:
 *   evolve int decision_G0 [0..10];
 * EvoChecker needs a literal bound, so `discretisation`'s value is
 * substituted, not the `N` constant's name.
 */
export const decisionVariablesTemplate = ({
  gm,
  enabled = true,
  evolvable = false,
  discretisation = DEFAULT_DISCRETISATION,
}: {
  gm: EdgeGoalTree;
  enabled?: boolean;
  evolvable?: boolean;
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

  const declaration = (name: string): string =>
    evolvable
      ? `evolve int ${name} [0..${discretisation}];`
      : `const int ${name};`;

  return [scale, ...names.map(declaration)].join('\n');
};

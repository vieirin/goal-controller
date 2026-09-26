import {
  achievableFormulaVariable,
  DISCRETISATION_CONSTANT as N,
  relativeFormulaVariable,
  stateVariable,
} from '../../../../../template/common';
import {
  decisionVariableName,
  selectionDecisionVariableName,
} from '../../../../../template/decisionVariables';

export type PursueStatement = { left: string; right: string };

/** G{id}_achievable*N > decision_G{id} */
export const shouldPursue = (nodeId: string): string =>
  `${achievableFormulaVariable(nodeId)}*${N} > ${decisionVariableName(nodeId)}`;

export const parentShouldPursue = shouldPursue;
export const childShouldPursue = shouldPursue;

/** G{id}_achievable*N <= decision_G{id} */
export const shouldSkip = (nodeId: string): string =>
  `${achievableFormulaVariable(nodeId)}*${N} <= ${decisionVariableName(nodeId)}`;

export const parentShouldSkip = shouldSkip;

/** Other children idle: g*_state=0 */
export const otherChildrenIdle = (
  childIds: string[],
  currentChildId: string,
): string =>
  childIds
    .filter((id) => id !== currentChildId)
    .map((id) => `${stateVariable(id)}=0`)
    .join(' & ');

/** All children idle: g*_state=0 */
export const childrenIdle = (childIds: string[]): string =>
  childIds.map((id) => `${stateVariable(id)}=0`).join(' & ');

/** (G1_achievable/(G1_achievable+G2_achievable))*N > _decision_G0 */
const shareAboveDecision = (
  parentGoalId: string,
  childIds: string[],
  childId: string,
): string =>
  `(${achievableFormulaVariable(childId)}/(${childIds
    .map(achievableFormulaVariable)
    .join('+')}))*${N} > ${selectionDecisionVariableName(parentGoalId)}`;

/** G1_relative*N > _decision_G0 (achievement-aware share, AND anyOrder) */
const relativeAboveDecision = (parentGoalId: string, childId: string): string =>
  `${relativeFormulaVariable(childId)}*${N} > ${selectionDecisionVariableName(parentGoalId)}`;

/**
 * Priority cascade used by the EDGE reference to pick one child: the child's
 * share must reach `_decision_G<parent>` and every higher-priority (earlier)
 * child's share must not.
 *   child i: share_i*N > _d & !(share_0*N > _d) & … & !(share_{i-1}*N > _d)
 */
const cascade = (
  orderedChildIds: string[],
  childId: string,
  above: (id: string) => string,
): string => {
  const index = orderedChildIds.indexOf(childId);
  if (index < 0) {
    throw new Error(
      `Child ${childId} not in children [${orderedChildIds.join(', ')}]`,
    );
  }
  return [
    above(childId),
    ...orderedChildIds.slice(0, index).map((id) => `!(${above(id)})`),
  ].join(' & ');
};

/** OR goals: share of raw achievabilities (reference non-idempotent / committed / preferred). */
export const selectChildByDecision = (
  parentGoalId: string,
  orderedChildIds: string[],
  childId: string,
): string =>
  cascade(orderedChildIds, childId, (id) =>
    shareAboveDecision(parentGoalId, orderedChildIds, id),
  );

/** AND anyOrder: share of not-yet-achieved siblings (reference flexible). */
export const selectChildByRelativeDecision = (
  parentGoalId: string,
  orderedChildIds: string[],
  childId: string,
): string =>
  cascade(orderedChildIds, childId, (id) =>
    relativeAboveDecision(parentGoalId, id),
  );

/** Append non-empty guard fragments with & */
export const joinGuards = (
  ...parts: Array<string | null | undefined>
): string =>
  parts.filter((p): p is string => Boolean(p && p.length > 0)).join(' & ');

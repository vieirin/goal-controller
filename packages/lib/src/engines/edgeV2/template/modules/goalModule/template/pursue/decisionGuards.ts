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

/** G{id}_achievable*N > decision_G{id}; empty (true) with Decision variables off */
export const shouldPursue = (nodeId: string, enabled = true): string =>
  enabled
    ? `${achievableFormulaVariable(nodeId)}*${N} > ${decisionVariableName(nodeId)}`
    : '';

export const parentShouldPursue = shouldPursue;
export const childShouldPursue = shouldPursue;

/** G{id}_achievable*N <= decision_G{id}; empty (true) with Decision variables off */
export const shouldSkip = (nodeId: string, enabled = true): string =>
  enabled
    ? `${achievableFormulaVariable(nodeId)}*${N} <= ${decisionVariableName(nodeId)}`
    : '';

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

/** G{id}_relative*N > _decision_G{id}: achievement-aware share vs the child's own threshold. */
const childShareAboveDecision = (childId: string): string =>
  `${relativeFormulaVariable(childId)}*${N} > ${selectionDecisionVariableName(childId)}`;

/**
 * Priority cascade used by the EDGE reference to pick one child: the child's
 * own achievement-aware share must reach its own `_decision_G<child>` and
 * every higher-priority (earlier) child's share must not reach *its own*
 * threshold (EDGE-XT 3094b5d; goal-controller deliberately uses each
 * sibling's own threshold in the negation, not the current child's).
 *   child i: share_i*N > _d_i & !(share_0*N > _d_0) & … & !(share_{i-1}*N > _d_{i-1})
 * Empty (true) with Decision variables off.
 */
const cascade = (
  orderedChildIds: string[],
  childId: string,
  enabled: boolean,
): string => {
  const index = orderedChildIds.indexOf(childId);
  if (index < 0) {
    throw new Error(
      `Child ${childId} not in children [${orderedChildIds.join(', ')}]`,
    );
  }
  if (!enabled) {
    return '';
  }
  return [
    childShareAboveDecision(childId),
    ...orderedChildIds
      .slice(0, index)
      .map((id) => `!(${childShareAboveDecision(id)})`),
  ].join(' & ');
};

/**
 * Child selection for OR (non-idempotent / committed / preferred) and AND
 * anyOrder (flexible) goals alike: each child's achievement-aware share vs
 * its own threshold, with priority to earlier children.
 */
export const selectChildByDecision = (
  orderedChildIds: string[],
  childId: string,
  enabled = true,
): string => cascade(orderedChildIds, childId, enabled);

export const selectChildByRelativeDecision = selectChildByDecision;

/** Append non-empty guard fragments with & */
export const joinGuards = (
  ...parts: Array<string | null | undefined>
): string =>
  parts.filter((p): p is string => Boolean(p && p.length > 0)).join(' & ');

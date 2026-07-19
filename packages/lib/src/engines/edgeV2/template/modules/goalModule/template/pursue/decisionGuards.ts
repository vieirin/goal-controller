import { parenthesis } from '../../../../../mdp/common';
import {
  achievableFormulaVariable,
  stateVariable,
} from '../../../../../template/common';
import {
  decisionVariableName,
  selectionDecisionVariableName,
} from '../../../../../template/decisionVariables';

export type PursueStatement = { left: string; right: string };

/** G{id}_achievable*10.0 > decision_G{id} */
export const shouldPursue = (goalId: string): string =>
  `${achievableFormulaVariable(goalId)}*10.0 > ${decisionVariableName(goalId)}`;

export const parentShouldPursue = shouldPursue;
export const childShouldPursue = shouldPursue;

/** Other children not currently pursued: g*_state!=1 */
export const otherChildrenNotPursued = (
  childIds: string[],
  currentChildId: string,
): string =>
  childIds
    .filter((id) => id !== currentChildId)
    .map((id) => `${stateVariable(id)}!=1`)
    .join(' & ');

/** Other children idle: g*_state=0 */
export const otherChildrenIdle = (
  childIds: string[],
  currentChildId: string,
): string =>
  childIds
    .filter((id) => id !== currentChildId)
    .map((id) => `${stateVariable(id)}=0`)
    .join(' & ');

/** G{id}_achievable*10.0 <= decision_G{id} */
export const shouldSkip = (goalId: string): string =>
  `${achievableFormulaVariable(goalId)}*10.0 <= ${decisionVariableName(goalId)}`;

export const parentShouldSkip = shouldSkip;

/**
 * Child selection vs `_decision_G{parent}` on a 0..10 scale.
 * Used by OR joints and AND anyOrder.
 * N=2 matches EDGEV2: (G1/(G1+G2))*10.0 ?> _decision
 * N>2: ordered cumulative achievability bands.
 */
export const selectChildByDecision = (
  parentGoalId: string,
  orderedChildIds: string[],
  currentChildId: string,
): string => {
  const index = orderedChildIds.indexOf(currentChildId);
  if (index < 0) {
    throw new Error(
      `Child ${currentChildId} not in children [${orderedChildIds.join(', ')}]`,
    );
  }

  const decision = selectionDecisionVariableName(parentGoalId);
  const terms = orderedChildIds.map((id) => achievableFormulaVariable(id));
  const sum = terms.join('+');
  const cum = (endExclusive: number): string => {
    const slice = terms.slice(0, endExclusive);
    const [first, ...rest] = slice;
    if (!first) {
      return '0';
    }
    return rest.length === 0 ? first : parenthesis(slice.join('+'));
  };

  const n = orderedChildIds.length;
  if (n === 1) {
    return 'true';
  }

  // band upper for first k children: sum(s0..s_{k-1})/S * 10
  const bandUpper = (k: number): string =>
    `${parenthesis(`${cum(k)}/(${sum})`)}*10.0`;

  if (index === 0) {
    // first: (s0/S)*10 > _decision
    return `${bandUpper(1)} > ${decision}`;
  }
  if (index === n - 1) {
    // last: sum(s0..s_{n-2})/S*10 <= _decision
    return `${bandUpper(n - 1)} <= ${decision}`;
  }
  // middle: lower <= _decision < upper
  return `${bandUpper(index)} <= ${decision} & ${bandUpper(index + 1)} > ${decision}`;
};

/** Append non-empty guard fragments with & */
export const joinGuards = (
  ...parts: Array<string | null | undefined>
): string =>
  parts.filter((p): p is string => Boolean(p && p.length > 0)).join(' & ');

import type { EdgeGoalNode } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import {
  chosenVariable,
  goalFailedVariable,
} from '../../../../../template/common';
import { orderedChildIds, retriedChildren } from '../children';
import {
  hasFailedExactlyNTimes,
  hasFailedLessThanNTimes,
} from './common';
import {
  childShouldPursue,
  joinGuards,
  otherChildrenIdle,
  parentShouldPursue,
  selectChildByDecision,
  type PursueStatement,
} from './decisionGuards';

/**
 * OR + alternative (reference `non-idempotent`):
 *   G0_achievable*N > decision_G0 & g{other}_state=0 … & priority cascade on _decision_G0
 */
export const pursueAlternativeGoal = (
  goal: EdgeGoalNode,
  currentChildId: string,
): string => {
  const children = orderedChildIds(goal);
  const { alternative: alternativeLogger } = getLogger().pursue.executionDetail;

  alternativeLogger(
    currentChildId,
    children.filter((id) => id !== currentChildId),
  );

  return joinGuards(
    parentShouldPursue(goal.id),
    otherChildrenIdle(children, currentChildId),
    selectChildByDecision(goal.id, children, currentChildId),
  );
};

/**
 * OR + choice (reference `committed`) — two lines per child:
 * 1) choose once: chosen=0 & parent decide & others idle & cascade -> (chosen'=i)
 * 2) keep the commitment: chosen=i & child decide -> true
 */
export const pursueChoiceGoal = (
  goal: EdgeGoalNode,
  orderedChildren: string[],
  currentChildId: string,
): PursueStatement[] => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Choice goals are not supported for AND joints. Found in goal ${goal.id}`,
    );
  }

  const index = orderedChildren.indexOf(currentChildId);
  if (index < 0) {
    throw new Error(
      `Child ${currentChildId} not in choice children [${orderedChildren.join(', ')}]`,
    );
  }
  const chosenIndex = index + 1; // 1-based
  const chosen = chosenVariable(goal.id);
  const { choice: choiceLogger } = getLogger().pursue.executionDetail;
  choiceLogger(
    currentChildId,
    orderedChildren.filter((id) => id !== currentChildId),
    `${chosen}=0`,
  );

  const chooseOnce: PursueStatement = {
    left: joinGuards(
      `${chosen}=0`,
      parentShouldPursue(goal.id),
      otherChildrenIdle(orderedChildren, currentChildId),
      selectChildByDecision(goal.id, orderedChildren, currentChildId),
    ),
    right: `(${chosen}'=${chosenIndex})`,
  };

  const continueChosen: PursueStatement = {
    left: joinGuards(`${chosen}=${chosenIndex}`, childShouldPursue(currentChildId)),
    right: 'true',
  };

  return [chooseOnce, continueChosen];
};

/** g{c}_failed=K for every retried child before `index` in the retry chain */
export const retriesExhausted = (
  goal: EdgeGoalNode,
  upTo: number = Number.POSITIVE_INFINITY,
): string =>
  retriedChildren(goal)
    .slice(0, upTo)
    .map(({ id, retries }) => hasFailedExactlyNTimes(id, retries))
    .join(' & ');

/**
 * OR + degradation (reference `preferred`).
 * Retry phase — each retried child in notation order, once the earlier ones
 * are exhausted:
 *   g{prev}_failed=K … & g{c}_failed<K & G{c}_achievable*N > decision_G{c} -> (g{c}_failed'=g{c}_failed+1)
 * Fallback phase — all retries exhausted, pick any child like an alternative:
 *   g{c}_failed=K … & G0_achievable*N > decision_G0 & g{other}_state=0 … & cascade -> true
 * `[G1@3->G2]` is exactly the reference `preferred` construct.
 */
export const pursueDegradationGoal = (
  goal: EdgeGoalNode,
  degradationList: string[],
  currentChildId: string,
): PursueStatement[] => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Degradation goals are not supported for AND joints. Found in goal ${goal.id}`,
    );
  }

  const { degradation: degradationLogger } = getLogger().pursue.executionDetail;
  degradationLogger.init(currentChildId, degradationList);

  const statements: PursueStatement[] = [];
  const chain = retriedChildren(goal);
  const position = chain.findIndex(({ id }) => id === currentChildId);
  const retried = chain[position];

  if (retried) {
    const { retries } = retried;
    degradationLogger.retry(currentChildId, currentChildId, retries);
    const failed = goalFailedVariable(currentChildId);
    statements.push({
      left: joinGuards(
        retriesExhausted(goal, position),
        hasFailedLessThanNTimes(currentChildId, retries),
        childShouldPursue(currentChildId),
      ),
      right: `(${failed}'=${failed}+1)`,
    });
  }

  statements.push({
    left: joinGuards(
      retriesExhausted(goal),
      parentShouldPursue(goal.id),
      otherChildrenIdle(degradationList, currentChildId),
      selectChildByDecision(goal.id, degradationList, currentChildId),
    ),
    right: 'true',
  });

  return statements;
};

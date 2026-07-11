import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import {
  chosenVariable,
  goalFailedVariable,
} from '../../../../../template/common';
import {
  hasFailedExactlyNTimes,
  hasFailedLessThanNTimes,
} from './common';
import {
  childShouldPursue,
  joinGuards,
  orSelectChild,
  otherChildrenIdle,
  parentShouldPursue,
  type PursueStatement,
} from './decisionGuards';

type PursueableNode = EdgeGoalNode | EdgeTask;

const pursueableChildIds = (goal: EdgeGoalNode): string[] =>
  Node.children(goal)
    .filter((child): child is PursueableNode => !Node.isResource(child))
    .map((child) => child.id);

/**
 * OR + alternative (EDGEV2):
 *   parent decide & other state=0 & ratio vs _decision
 */
export const pursueAlternativeGoal = (
  goal: EdgeGoalNode,
  currentChildId: string,
): string => {
  const children = pursueableChildIds(goal);
  const { alternative: alternativeLogger } = getLogger().pursue.executionDetail;

  alternativeLogger(
    currentChildId,
    children.filter((id) => id !== currentChildId),
  );

  return joinGuards(
    parentShouldPursue(goal.id),
    otherChildrenIdle(children, currentChildId),
    orSelectChild(goal.id, children, currentChildId),
  );
};

/**
 * OR + choice (EDGEV2) — two lines:
 * 1) choose: chosen=0 & parent decide & others idle & ratio -> (chosen'=i)
 * 2) continue: chosen=i & child decide -> true
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
      orSelectChild(goal.id, orderedChildren, currentChildId),
    ),
    right: `(${chosen}'=${chosenIndex})`,
  };

  const continueChosen: PursueStatement = {
    left: joinGuards(`${chosen}=${chosenIndex}`, childShouldPursue(currentChildId)),
    right: 'true',
  };

  return [chooseOnce, continueChosen];
};

const retryLimitForChild = (
  goal: EdgeGoalNode,
  childId: string,
): number | null => {
  const fromMap = goal.properties.engine.executionDetail?.retryMap?.[childId];
  if (typeof fromMap === 'number' && fromMap > 0) {
    return fromMap;
  }
  const child = Node.children(goal).find((c) => c.id === childId);
  if (!child || Node.isResource(child)) {
    return null;
  }
  const maxRetries = child.properties.engine.maxRetries;
  return typeof maxRetries === 'number' && maxRetries > 0 ? maxRetries : null;
};

/**
 * OR + degradation (EDGEV2) — per child:
 * - If this child has retries: retry line failed<N & child decide -> (failed'=failed+1)
 * - Fallback (after retries exhausted on retrying children): failed=N & alternative-style select
 *
 * For children without their own retries, only emit the fallback line (gated on
 * exhausted retries of earlier degradation children that have maxRetries).
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
  const ownRetries = retryLimitForChild(goal, currentChildId);

  const retryChildren = degradationList
    .map((id) => ({ id, n: retryLimitForChild(goal, id) }))
    .filter((x): x is { id: string; n: number } => x.n !== null);

  if (ownRetries !== null) {
    degradationLogger.retry(currentChildId, currentChildId, ownRetries);
    const failed = goalFailedVariable(currentChildId);
    statements.push({
      left: joinGuards(
        hasFailedLessThanNTimes(currentChildId, ownRetries),
        childShouldPursue(currentChildId),
      ),
      right: `(${failed}'=${failed}+1)`,
    });
  }

  // Fallback / OR-select phase once all retry counters are exhausted
  const exhaustedGate = retryChildren
    .map(({ id, n }) => hasFailedExactlyNTimes(id, n))
    .join(' & ');

  // If there are no retry children, still allow alternative-style fallback
  const fallbackLeft = joinGuards(
    exhaustedGate || null,
    parentShouldPursue(goal.id),
    otherChildrenIdle(degradationList, currentChildId),
    orSelectChild(goal.id, degradationList, currentChildId),
  );

  statements.push({
    left: fallbackLeft,
    right: 'true',
  });

  return statements;
};

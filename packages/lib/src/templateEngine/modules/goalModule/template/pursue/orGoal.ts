import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../edgeTypes';
import { getLogger } from '../../../../../logger/logger';
import { pursued, separator } from '../../../../../mdp/common';
import { chosenVariable } from '../../../../common';
import { hasFailedAtLeastNTimes, hasFailedAtMostNTimes } from './common';

/*
G1: Goal[T1|T2]
module G1 //non-idempotent, a.k.a choose once!
  G1_pursued : [0..1] init 0;
  G1_achieved : [0..1] init 0;
  G1_chosen : [0..2] init 0; //which one is chosen?

//  [pursue_T1] G1_pursued=1 & G1_achieved=0 & G1_chosen!=2 -> (G1_chosen'=1);
//  [pursue_T2] G1_pursued=1 & G1_achieved=0 & G1_chosen!=1 -> (G1_chosen'=2);

  [achieved_G1] (T1_achieved>0 | T2_achieved>0) & G1_pursued=1 -> (G1_pursued'=0) & (G1_achieved'=1);
endmodule
*/

export const pursueChoiceGoal = (
  goal: EdgeGoalNode,
  alternative: string[],
  currentChildId: string,
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Alternative goals are not supported for AND joints. Found in goal ${goal.id}`,
    );
  }

  const { choice: choiceLogger } = getLogger().pursue.executionDetail;

  if (goal.relationToChildren === 'or') {
    const otherGoals = alternative.filter(
      (goalId) => goalId !== currentChildId,
    );
    const notChosen = otherGoals
      .map((goalId) => {
        const originalIndex = alternative.indexOf(goalId);
        return `${chosenVariable(goal.id)}!=${originalIndex + 1}`;
      })
      .join(separator('and'));

    choiceLogger(currentChildId, otherGoals, notChosen);
    return notChosen;
  }
  return '';
};

export const pursueDegradationGoal = (
  goal: EdgeGoalNode,
  degradationList: string[],
  currentChildId: string,
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Alternative goals are not supported for AND joints. Found in goal ${goal.id}`,
    );
  }
  const { degradation: degradationLogger } = getLogger().pursue.executionDetail;

  if (goal.relationToChildren === 'or') {
    const otherGoals = degradationList.filter(
      (goalId) => goalId !== currentChildId,
    );
    degradationLogger.init(currentChildId, degradationList);
    const maybeRetry =
      goal.properties.engine.executionDetail?.retryMap?.[currentChildId];
    if (maybeRetry) {
      return hasFailedAtMostNTimes(currentChildId, maybeRetry - 1);
    }

    const result = otherGoals
      .map((goalId) => {
        // For degradation, we only need to check retry conditions (failures of earlier goals)
        // We don't need to check if the parent goal has been pursued (that's already in the base guard)
        const maybeRetry =
          goal.properties.engine.executionDetail?.retryMap?.[goalId];
        const retryCondition =
          maybeRetry && hasFailedAtLeastNTimes(goalId, maybeRetry);

        if (maybeRetry) {
          degradationLogger.retry(currentChildId, goalId, maybeRetry);
        }

        return retryCondition || '';
      })
      .filter(Boolean)
      .join(separator('and'));
    return result;
  }

  return '';
};

// chooses either one of the children always
export const pursueAlternativeGoal = (
  goal: EdgeGoalNode,
  currentChildId: string,
): string => {
  const children = Node.children(goal);
  // Filter out resources - they don't have pursued state
  type PursueableNode = EdgeGoalNode | EdgeTask;
  const pursueableChildren = children.filter(
    (child): child is PursueableNode => !Node.isResource(child),
  );
  const otherGoals = pursueableChildren.filter(
    (child: PursueableNode) => child.id !== currentChildId,
  );
  const { alternative: alternativeLogger } = getLogger().pursue.executionDetail;

  alternativeLogger(
    currentChildId,
    otherGoals.map((child: PursueableNode) => child.id),
  );

  return otherGoals
    .map((child: PursueableNode) => {
      return `${pursued(child.id)}=0`;
    })
    .join(separator('and'));
};

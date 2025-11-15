import type { GoalNode } from '../../../../../GoalTree/types';
import { childrenIncludingTasks } from '../../../../../GoalTree/utils';
import { getLogger } from '../../../../../logger/logger';
import { pursued, separator } from '../../../../../mdp/common';
import { chosenVariable } from '../../../../common';
import { hasFailedAtLeastNTimes } from './common';

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
  goal: GoalNode,
  alternative: string[],
  currentChildId: string
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Alternative goals are not supported for AND joints. Found in goal ${goal.id}`
    );
  }

  const { choice: choiceLogger } = getLogger().pursue.executionDetail;

  if (goal.relationToChildren === 'or') {
    const otherGoals = alternative.filter(
      (goalId) => goalId !== currentChildId
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
  goal: GoalNode,
  degradationList: string[],
  currentChildId: string
): string => {
  if (goal.relationToChildren === 'and') {
    throw new Error(
      `Alternative goals are not supported for AND joints. Found in goal ${goal.id}`
    );
  }
  const { degradation: degradationLogger } = getLogger().pursue.executionDetail;

  if (goal.relationToChildren === 'or') {
    const otherGoals = degradationList.filter(
      (goalId) => goalId !== currentChildId
    );
    degradationLogger.init(currentChildId, degradationList);
    const result = otherGoals
      .map((goalId) => {
        // For degradation, we only need to check retry conditions (failures of earlier goals)
        // We don't need to check if the parent goal has been pursued (that's already in the base guard)
        const maybeRetry = goal.executionDetail?.retryMap?.[goalId];
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
  goal: GoalNode,
  currentChildId: string
): string => {
  const children = childrenIncludingTasks({ node: goal });
  const otherGoals = children.filter((child) => child.id !== currentChildId);
  const { alternative: alternativeLogger } = getLogger().pursue.executionDetail;

  alternativeLogger(
    currentChildId,
    otherGoals.map((child) => child.id)
  );

  return otherGoals
    .map((child) => {
      return `${pursued(child.id)}=0`;
    })
    .join(separator('and'));
};

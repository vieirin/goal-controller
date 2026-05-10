import { Node } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import {
  achievable,
  goalState,
  pursued,
  separator,
} from '../../../../../mdp/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import {
  chosenVariable,
  decisionVariable,
  underscoredOrDecisionVariable,
} from '../../../../common';

const ACHIEVABILITY_DECISION_SCALE = 10.0;

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

// chooses either one of the children always (snippets: parent achievability vs decision,
// siblings idle, then (G1_ach/(G1_ach+G2_ach))*10 >/<= _decision_parent)
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

  const scale = ACHIEVABILITY_DECISION_SCALE;
  const parentVsDecision = `${achievable(goal.id)}*${scale} > ${decisionVariable(goal.id)}`;

  const siblingIdle = otherGoals
    .map((child: PursueableNode) => {
      return Node.isTask(child)
        ? `${pursued(child.id)}=0`
        : `${goalState(child.id)}=0`;
    })
    .join(separator('and'));

  const parts: string[] = [parentVsDecision];
  if (siblingIdle) {
    parts.push(siblingIdle);
  }

  if (pursueableChildren.length >= 2) {
    const first = pursueableChildren[0];
    if (!first) {
      throw new Error(
        `Pursueable children unexpectedly empty for alternative goal ${goal.id}`,
      );
    }
    const sumAchievable = pursueableChildren
      .map((c) => achievable(c.id))
      .join('+');
    const ratioExpr = `(${achievable(first.id)}/(${sumAchievable}))*${scale}`;
    const underscored = underscoredOrDecisionVariable(goal.id);
    parts.push(
      currentChildId === first.id
        ? `${ratioExpr} > ${underscored}`
        : `${ratioExpr} <= ${underscored}`,
    );
  }

  return parts.join(separator('and'));
};

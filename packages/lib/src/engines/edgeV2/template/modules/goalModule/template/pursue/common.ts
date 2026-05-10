import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import {
  achieved,
  goalState,
  pursued,
  separator,
} from '../../../../../mdp/common';
import { achievedMaintain } from '../formulas';

// Node type that has both id and properties.engine.execCondition
type NodeWithExecCondition = EdgeGoalNode | EdgeTask;

export const hasBeenAchieved = (
  node: NodeWithExecCondition,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  if (node.type === 'task') {
    return `${achieved(node.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
  }

  if (node.properties.engine.execCondition?.maintain) {
    if (update) {
      throw new Error(
        'Invalid update option for goal of type maintain, please verify',
      );
    }
    return `${achievedMaintain(node.id)}=${condition ? 'true' : 'false'}`;
  }

  if (update) {
    throw new Error(
      'Invalid update option for goal achieved formula, please verify',
    );
  }
  return condition ? `${achieved(node.id)}` : `!${achieved(node.id)}`;
};

export const hasBeenPursued = (
  node: NodeWithExecCondition,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  const name = Node.isTask(node) ? pursued(node.id) : goalState(node.id);
  return `${name}${update ? "'" : ''}=${condition ? 1 : 0}`;
};

export const hasBeenAchievedAndPursued = (
  node: NodeWithExecCondition,
  { achieved, pursued }: { achieved: boolean; pursued: boolean },
): string => {
  return [
    hasBeenPursued(node, { condition: pursued }),
    hasBeenAchieved(node, { condition: achieved }),
  ].join(separator('and'));
};

export const hasFailedAtLeastNTimes = (goalId: string, n: number): string => {
  return `${goalId}_failed >= ${n}`;
};

export const hasFailedAtMostNTimes = (goalId: string, n: number): string => {
  return `${goalId}_failed <= ${n}`;
};

import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { separator } from '../../../../../mdp/common';
import {
  achievedFormula,
  goalFailedVariable,
  stateVariable,
} from '../../../../../template/common';

// Node type that has both id and properties.engine.execCondition
type NodeWithExecCondition = EdgeGoalNode | EdgeTask;

export const hasBeenAchieved = (
  node: NodeWithExecCondition,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  if (update) {
    return `${achievedFormula(node.id)}'=${condition ? 1 : 0}`;
  }

  return condition ? achievedFormula(node.id) : `!${achievedFormula(node.id)}`;
};

export const hasBeenPursued = (
  node: NodeWithExecCondition,
  { condition, update }: { condition: boolean; update?: boolean },
): string => {
  return `${stateVariable(node.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
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
  return `${goalFailedVariable(goalId)}>=${n}`;
};

export const hasFailedAtMostNTimes = (goalId: string, n: number): string => {
  return `${goalFailedVariable(goalId)}<=${n}`;
};

export const hasFailedLessThanNTimes = (goalId: string, n: number): string => {
  return `${goalFailedVariable(goalId)}<${n}`;
};

export const hasFailedExactlyNTimes = (goalId: string, n: number): string => {
  return `${goalFailedVariable(goalId)}=${n}`;
};

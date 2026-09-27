import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree, EdgeTask } from '../../../types';
import { achievedTransition, pursueTransition } from '../../common';
import { goalNumberId } from '../goalModule/goalModules';

type RewardNode = EdgeGoalNode | EdgeTask;

/**
 * Reward value from a goal/task custom property. Empty or 0 means "no reward"
 * (no line is emitted); anything else must be a non-negative number.
 */
const rewardValue = (
  node: RewardNode,
  property: 'utility' | 'cost',
): string | null => {
  const text = node.properties.engine[property].trim();
  if (!text) {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(
      `[INVALID MODEL]: ${node.id} has ${property} "${text}"; it must be a non-negative number`,
    );
  }
  return Number(text) === 0 ? null : text;
};

const rewardStructure = (name: string, lines: string[]): string =>
  lines.length === 0 ? '' : `rewards "${name}"\n  ${lines.join('\n  ')}\nendrewards`;

/**
 * Reward structures from the goal model's `cost` and `utility` properties
 * (goals and tasks):
 *   rewards "cost"
 *     [pursue_T5] true : 3;      // paid each time T5 is pursued
 *   endrewards
 *   rewards "utility"
 *     [achieved_T5] true : 3;    // earned when T5 is achieved
 *     [achieved_G19] true : 5;
 *   endrewards
 * A structure without any entry is omitted.
 */
export const rewardsTemplate = ({ gm }: { gm: EdgeGoalTree }): string => {
  const nodes: RewardNode[] = [
    ...GoalTree.allByType(gm, 'task'),
    ...GoalTree.allByType(gm, 'goal'),
  ].sort((a, b) => Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)));

  const cost = nodes.flatMap((node) => {
    const value = rewardValue(node, 'cost');
    return value ? [`[${pursueTransition(node.id)}] true : ${value};`] : [];
  });
  const utility = nodes.flatMap((node) => {
    const value = rewardValue(node, 'utility');
    return value ? [`[${achievedTransition(node.id)}] true : ${value};`] : [];
  });

  return [rewardStructure('cost', cost), rewardStructure('utility', utility)]
    .filter(Boolean)
    .join('\n\n');
};

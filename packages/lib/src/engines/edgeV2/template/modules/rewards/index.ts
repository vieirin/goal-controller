import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree, EdgeTask } from '../../../types';
import { achievedTransition, pursueTransition } from '../../common';
import { goalNumberId } from '../goalModule/goalModules';

type RewardNode = EdgeGoalNode | EdgeTask;

/**
 * Reward value from a goal/task custom property. The mapper already hands the
 * text as written only when the dialect reads a non-negative number (#236), and
 * `''` otherwise: empty or zero means no reward (no line is emitted).
 */
const rewardValue = (
  node: RewardNode,
  property: 'utility' | 'cost',
): string | null => {
  const text = node.properties.engine[property];
  if (!text || Number(text) === 0) return null;
  return text;
};

const rewardStructure = (name: string, lines: string[]): string =>
  lines.length === 0
    ? ''
    : `rewards "${name}"\n  ${lines.join('\n  ')}\nendrewards`;

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

import { GoalTree } from '../GoalTree/types';
import { achieved } from './common';

type Reward = { goalId: string } & ({ utility: number } | { cost: number });

const rewardsMapping = <T extends 'utility' | 'cost'>({
  type,
  tree,
}: {
  type: T;
  tree: GoalTree;
}): Reward[] => {
  return (
    tree?.flatMap((goal) => {
      const reward = goal.customProperties[type];
      const childrenRewards = goal.children
        ? rewardsMapping({ type: type, tree: goal.children })
        : [];

      const rewardValue = Number(reward);
      if (reward && Number.isNaN(rewardValue)) {
        throw new Error(`[${goal.id}] Invalid value from reward: ${reward}`);
      }

      if (reward) {
        const value =
          type === 'utility' ? { utility: rewardValue } : { cost: rewardValue };
        return [{ goalId: goal.id, ...value }, ...childrenRewards];
      }

      return childrenRewards;
    }) ?? []
  );
};

export const rewards = ({
  type,
  gm,
}: {
  type: 'utility' | 'cost';
  gm: GoalTree;
}) => {
  return `rewards "${type}"
${rewardsMapping({ type, tree: gm })
  .map((reward) => {
    const value = 'utility' in reward ? reward.utility : reward.cost;
    return `  [success] ${achieved(reward.goalId)}: ${value};`;
  })
  .join('\n')}
endrewards`;
};

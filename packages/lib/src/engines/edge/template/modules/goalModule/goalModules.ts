import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree } from '../../../types';
import { goalModule } from './template';

export const goalNumberId = (goalId: string): string => {
  const id = goalId.match(/\d+/)?.[0];
  if (!id) {
    throw new Error(
      `The goal id must follow the pattern 'G%d', got: '${goalId}'`,
    );
  }
  return id;
};

export const goalModules = ({ gm }: { gm: EdgeGoalTree }): string => {
  const goals = GoalTree.allByType(gm, 'goal');
  return `
${goals
  .sort(
    (a: EdgeGoalNode, b: EdgeGoalNode) =>
      Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0]),
  )
  .map(goalModule)
  .join('\n\n')}
`;
};


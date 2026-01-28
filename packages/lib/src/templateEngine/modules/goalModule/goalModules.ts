import { type GoalTree, type GoalNode } from '@goal-controller/goal-tree';
import { allByType } from '@goal-controller/goal-tree';
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

export const goalModules = ({ gm }: { gm: GoalTree }): string => {
  const goals = allByType({ gm, type: 'goal' });
  return `
${goals
  .sort(
    (a: GoalNode, b: GoalNode) =>
      Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0]),
  )
  .map(goalModule)
  .join('\n\n')}
`;
};

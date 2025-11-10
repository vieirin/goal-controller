import { type GoalTree } from '../../../GoalTree/types';
import { allByType } from '../../../GoalTree/utils';
import { goalModule } from './template';

export const goalNumberId = (goalId: string) => {
  const id = goalId.match(/\d+/)?.[0];
  if (!id) {
    throw new Error(
      `The goal id must follow the pattern 'G%d', got: '${goalId}'`
    );
  }
  return id;
};

export const goalModules = ({ gm }: { gm: GoalTree }) => {
  const goals = allByType({ gm, type: 'goal' });
  return `
${goals
  .sort(
    (a, b) => Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0])
  )
  .map(goalModule)
  .join('\n\n')}
`;
};

import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeGoalTree } from '../../../types';
import { goalModule } from './template';

/**
 * Extracts the numeric ID from a goal/task/resource ID string.
 * IDs must follow the pattern: G<number>, T<number>, or R<number>
 * @param goalId - The ID string (e.g., "G1", "T5", "R3")
 * @returns The numeric portion as a string
 * @throws Error if the ID doesn't match the required pattern
 */
export const goalNumberId = (goalId: string): string => {
  const match = goalId.match(/^[GTR](\d+)$/i);
  if (!match || match[1] === undefined) {
    throw new Error(
      `ID must follow pattern 'G<number>', 'T<number>', or 'R<number>', got: '${goalId}'`,
    );
  }
  return match[1];
};

export const goalModules = ({ gm }: { gm: EdgeGoalTree }): string => {
  const goals = GoalTree.allByType(gm, 'goal');
  return `
${goals
  .sort(
    (a: EdgeGoalNode, b: EdgeGoalNode) =>
      Number(goalNumberId(a.id)) - Number(goalNumberId(b.id)),
  )
  .map(goalModule)
  .join('\n\n')}
`;
};

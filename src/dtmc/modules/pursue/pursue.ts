import { achieved, pursued } from '../../../mdp/common';
import { GoalNode } from '../../../ObjectiveTree/types';
import { pursueInterleavedGoal } from './interleavedGoal';
import { pursueSequentialGoal } from './sequentialGoal';

export const pursueStatements = (goal: GoalNode): string[] => {
  const goalsToPursue = [goal, ...(goal.children || [])];

  const pursueLines = goalsToPursue
    .map((child, _, arr): [GoalNode, { left: string; right: string }] => {
      const isItself = child.id === goal.id;
      const leftStatement = `[pursue_${child.id}] ${pursued(goal.id)}=${isItself ? 0 : 1}`;
      if (isItself) {
        return [
          child,
          {
            left: leftStatement + ` & ${achieved(goal.id)}=0`,
            right: `(${pursued(goal.id)}'=1)`,
          },
        ] as const;
      }

      if (goal.executionDetail?.type === 'sequence') {
        const pursueCondition = pursueSequentialGoal(
          goal,
          goal.executionDetail.sequence,
          child.id
        );
        return [
          child,
          {
            left: leftStatement + ` & ${pursueCondition}`,
            right: 'true',
          },
        ] as const;
      }

      if (goal.executionDetail?.type === 'interleaved') {
        const pursueCondition = pursueInterleavedGoal(
          goal,
          goal.executionDetail.interleaved,
          child.id
        );

        return [
          child,
          { left: leftStatement + ` & ${pursueCondition}`, right: 'true' },
        ] as const;
      }
      return [child, { left: leftStatement, right: leftStatement }] as const;
    })
    .map(([child, statement]): { left: string; right: string } => {
      return {
        left: `${statement.left}`,
        right: `${statement.right}`,
      };
    })
    .map(
      (statements) =>
        // TODO: decision variables stage
        statements
    )
    .map((statement): string => {
      return `${statement.left} -> ${statement.right};`;
    })
    .flat();

  return pursueLines ?? [];
};

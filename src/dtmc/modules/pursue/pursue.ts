import { achieved, pursued } from '../../../mdp/common';
import { GoalNode } from '../../../ObjectiveTree/types';
import { pursueInterleavedGoal } from './interleavedGoal';
import { pursueSequentialGoal } from './sequentialGoal';

export const pursueStatements = (goal: GoalNode): string[] => {
  const goalsToPursue = [goal, ...(goal.children || []), ...(goal.tasks || [])];

  const pursueLines = goalsToPursue
    .map((child, _): [GoalNode, { left: string; right: string }] => {
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

      switch (goal.executionDetail?.type) {
        case 'sequence': {
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
        case 'interleaved': {
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
        default:
          return [child, { left: leftStatement, right: 'true' }] as const;
      }
    })
    .map(([, statement]): { left: string; right: string } => {
      // TODO: decision variables stage
      return {
        left: `${statement.left}`,
        right: `${statement.right}`,
      };
    })
    .map((statement): string => {
      return `${statement.left} -> ${statement.right};`;
    });

  return pursueLines ?? [];
};

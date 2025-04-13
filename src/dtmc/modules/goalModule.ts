import { achieved, pursued, separator } from '../../mdp/common';
import { GoalNode, GoalNodeWithParent } from '../../ObjectiveTree/types';

const beenAchieved = (
  goalId: string,
  { condition }: { condition: boolean }
) => {
  return `${achieved(goalId)}=${condition ? 1 : 0}`;
};

const beenPursued = (goalId: string, { condition }: { condition: boolean }) => {
  return `${pursued(goalId)}=${condition ? 1 : 0}`;
};

const beenAchievedAndPursued = (
  goalId: string,
  {
    achievedCondition,
    pursuedCondition,
  }: { achievedCondition: boolean; pursuedCondition: boolean }
) => {
  return [
    beenPursued(goalId, { condition: pursuedCondition }),
    beenAchieved(goalId, { condition: achievedCondition }),
  ].join(' & ');
};

const pursueSequentialGoal = (
  goal: GoalNode,
  sequence: string[],
  childId: string
): string => {
  const sequenceIndex = sequence.indexOf(childId);
  const leftGoals = sequence.slice(0, sequenceIndex);
  const rightGoals = sequence.slice(sequenceIndex + 1);

  if (!goal.relationToChildren) {
    return '';
  }

  const resolveAndGoal = (): string => {
    if (leftGoals.length === 0) {
      return [
        beenAchieved(childId, { condition: false }),
        rightGoals
          .map((goal) => beenAchieved(goal, { condition: false }))
          .join(separator('and')),
      ].join(separator('and'));
    }

    return [
      ...leftGoals.map((goal) => beenAchieved(goal, { condition: true })),
      ...rightGoals.map((goal) => beenAchieved(goal, { condition: false })),
    ].join(separator('and'));
  };

  const resolveOrGoal = () => {
    if (leftGoals.length === 0) {
      return rightGoals
        .map((goal) =>
          beenAchievedAndPursued(goal, {
            pursuedCondition: false,
            achievedCondition: false,
          })
        )
        .join(separator('and'));
    }
    return leftGoals
      .map((goal) =>
        beenAchievedAndPursued(goal, {
          pursuedCondition: true,
          achievedCondition: false,
        })
      )
      .join(separator('and'));
  };

  if (goal.relationToChildren === 'and') {
    return resolveAndGoal();
  }

  if (goal.relationToChildren === 'or') {
    return resolveOrGoal();
  }

  return '';
};

const pursueStatements = (goal: GoalNode): string[] => {
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

const skipStatement = (goal: GoalNodeWithParent) => {
  return `[skip_${goal.id}] ${pursued(goal.id)}=1 -> (${pursued(goal.id)}'=0);`;
};

const achieveStatements = (goal: GoalNodeWithParent) => {
  return goal.parent.map((parent) => {
    return `[achieved_${goal.id}] ${pursued(goal.id)}=1 -> (${pursued(parent.id)}'=1) & (${achieved(goal.id)}'=1);`;
  });
};

export const managerGoalModule = (goal: GoalNodeWithParent) => {
  const pursueLines = pursueStatements(goal);
  const achieveLines = achieveStatements(goal);
  const skipLine = skipStatement(goal);
  return `
module ${goal.id}

  ${pursued(goal.id)} : [0..1] init 0;
  ${achieved(goal.id)} : [0..1] init 0;

  ${pursueLines.join('\n  ')}
  ${achieveLines.join('\n  ')}
  ${skipLine}

end module
`.trim();
};

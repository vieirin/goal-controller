import { achieved, pursued } from '../../mdp/common';
import { GoalNode, GoalNodeWithParent } from '../../ObjectiveTree/types';

const pursueStatements = (goal: GoalNode): string[] => {
  const goalsToPursue = [goal, ...(goal.children || [])];
  // console.log(goal.id, { goalsToPursue });
  const pursueLines = goalsToPursue
    // .sort((a, b) => a.id.localeCompare(b.id))
    .map((child): [GoalNode, { left: string; right: string }] => {
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

      return [child, { left: leftStatement, right: `true` }] as const;
    })
    .map(([child, statement]): { left: string; right: string }[] => {
      return [
        {
          left: `${statement.left}`,
          right: `${statement.right}`,
        },
      ];
    })
    .map(
      (statements) =>
        // TODO: decision variables stage
        statements
    )
    .map((statements): string[] => {
      return statements.map((statement) => {
        return `${statement.left} -> ${statement.right};`;
      });
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

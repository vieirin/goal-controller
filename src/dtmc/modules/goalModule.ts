import { achieved, pursued } from '../../mdp/common';
import { GoalNode, GoalNodeWithParent } from '../../ObjectiveTree/types';
import { goalNumberId } from './goalManager';

const pursueStatements = (goal: GoalNode): string[] => {
  const pursueLines = goal.children
    ?.sort((a, b) => a.id.localeCompare(b.id))
    .map((child): [GoalNode, { left: string; right: string }] => {
      // default statement, no monitors
      const leftStatement = `[pursue_${goal.id}_${child.id}] turn=0 & goal=${goalNumberId(goal.id)} & ${pursued(goal.id)}=0`;
      const rightStatement = `(${pursued(goal.id)}'=1)`;
      return [child, { left: leftStatement, right: rightStatement }] as const;
    })
    .map(([child, statement]): { left: string; right: string }[] => {
      if (!child.monitors?.length) {
        return [
          {
            left: `${statement.left} & decision_${goal.id}=1`,
            right: `${statement.right} & (goal'=${goalNumberId(child.id)})`,
          },
        ];
      }
      //monitors stage
      return child.monitors.flatMap((monitor) => {
        return [
          //monitor decision
          {
            left: `${statement.left} & ${monitor.id} & decision_${goal.id}_${monitor.id}>0`,
            right: `${statement.right} & (goal'=decision_${goal.id}_${monitor.id})`,
          },
          // not monitor decision
          {
            left: `${statement.left} & !${monitor.id} & decision_${goal.id}_not${monitor.id}>0`,
            right: `${statement.right} & (goal'=decision_${goal.id}_not${monitor.id})`,
          },
        ];
      });
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

const skipStatements = (goal: GoalNodeWithParent) => {
  const startStatements = [
    { left: `turn=0 & goal=1 & G1_pursued=0`, right: `(goal'=${goal.parent})` },
  ];
  return [];
};

const achieveStatements = (goal: GoalNodeWithParent) => {
  if (!goal.parent.length) {
    return [
      `[achieved_${goal.id}] turn=0 & goal=${goalNumberId(goal.id)} -> true;`,
    ];
  }
  return goal.parent.map((parent) => {
    return `[achieved_${goal.id}_${parent.id}] turn=0 & goal=${goalNumberId(goal.id)} -> (goal'=${goalNumberId(parent.id)});`;
  });
};

export const managerGoalModule = (goal: GoalNodeWithParent) => {
  const pursueLines = pursueStatements(goal);
  const achieveLines = achieveStatements(goal);

  return `
module ${goal.id}

  ${pursued(goal.id)} : [0..1] init 0;
  ${achieved(goal.id)} : [0..1] init 0;

  ${pursueLines.join('\n  ')}
  ${achieveLines.join('\n  ')}

end module
`.trim();
};

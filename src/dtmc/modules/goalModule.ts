import { achieved, pursued } from '../../mdp/common';
import { GoalNodeWithParent } from '../../ObjectiveTree/types';
import { pursueStatements } from './pursue/pursue';

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

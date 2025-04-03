import { achieved, failed, pursue, pursued } from '../../mdp/common';
import type {
  GoalNodeWithParent,
  GoalTreeWithParent,
} from '../../ObjectiveTree/types';
import { allByType } from '../../ObjectiveTree/utils';

const pursueItself = (goal: GoalNodeWithParent) => {
  return `[${pursue(goal.id)}] ${pursued(goal.id)}=0 & ${achieved(goal.id)}=0 -> (${pursued(goal.id)}'=1);`;
};

const pursueChildren = (goal: GoalNodeWithParent) => {
  if (!goal.children) {
    return [];
  }

  // TODO:  add conditions
  return goal.children.map((child) => {
    return `[${pursue(child.id)}] ${pursued(goal.id)}=1 -> true;`;
  });
};

const maybeFailedVariable = (goal: GoalNodeWithParent) => {
  if (!goal.customProperties.alt) {
    return '';
  }

  // only alternative goals maintain a state for how many times they failed
  return `${failed(goal.id)}: [0..10] init 0;`;
};

const generatePrismModuleForGoal = (goal: GoalNodeWithParent) => {
  return `
module ${goal.id}
  ${pursued(goal.id)}: [0..1] init 0;
  ${achieved(goal.id)}: [0..1] init 0;
  ${maybeFailedVariable(goal)}

  ${pursueItself(goal)}
  ${pursueChildren(goal)}

  // TODO: Handle maintain case
endmodule
`;
};

export const goalModuleTemplate = ({ gm }: { gm: GoalTreeWithParent }) => {
  const goals = allByType({ gm, type: 'goal' });
  return goals.map(generatePrismModuleForGoal).join('\n');
};

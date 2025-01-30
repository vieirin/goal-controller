import { achieved, parenthesis } from '../../mdp/common';
import { GoalNodeWithParent } from '../../ObjectiveTree/types';

const allChildrenAchieved = (goal: GoalNodeWithParent) => {
  const childrenToUse = goal.children?.length ? goal.children : goal.tasks;

  return childrenToUse?.map((child) => `${achieved(child.id)}>0`).join(' & ');
};

const anyChildAchieved = (goal: GoalNodeWithParent) => {
  const childrenToUse = goal.children?.length ? goal.children : goal.tasks;
  if (!childrenToUse?.length) return '';

  return parenthesis(
    childrenToUse?.map((child) => `${achieved(child.id)}>0`).join(' | ')
  );
};

const successLine = (goal: GoalNodeWithParent) => {
  const left = `[${goal.id}_success] goal=${goal.index} & ${
    goal.relationToChildren === 'and'
      ? allChildrenAchieved(goal)
      : anyChildAchieved(goal)
  }`;

  const hasParent = !!goal.parent[0];
  const returnToParent = hasParent ? `(goal'=${goal.parent[0].index})` : '';

  const right = [returnToParent, `(${achieved(goal.id)}'=1)`]
    .filter(Boolean)
    .join(' & ');

  return `${left} -> ${right}`;
};

export const managerGoalModule = (goal: GoalNodeWithParent) => {
  return successLine(goal);
};

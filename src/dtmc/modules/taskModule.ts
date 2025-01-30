import { achieved } from '../../mdp/common';
import { GoalNodeWithParent } from '../../ObjectiveTree/types';

const pursueLine = (task: GoalNodeWithParent) => {
  return ` [pursue${task.id}] goal=${task.index} -> true;`;
};

const successLine = (task: GoalNodeWithParent) => {
  return `[${task.id}success] goal=${task.index} -> (goal'=${
    task.parent[0].index
  }) & (${achieved(task.id)}'=1)`;
};

const failLine = (task: GoalNodeWithParent) => {
  return `[${task.id}fail] goal=${task.index} -> (goal'=${task.parent[0].index})`;
};

export const taskModule = (task: GoalNodeWithParent) => {
  return [pursueLine(task), successLine(task), failLine(task)].join('\n  ');
};

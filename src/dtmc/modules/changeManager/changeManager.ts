import { achieved, pursue } from '../../../mdp/common';
import type {
  GoalNode,
  GoalTreeWithParent,
} from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';

const pursueTask = (task: GoalNode) => {
  return `[${pursue(task.id)}] true -> true;`;
};

const achieveTask = (task: GoalNode) => {
  return `[${achieved(task.id)}] true -> true;`;
};

const taskDeclaration = (task: GoalNode) => {
  return `
  ${pursueTask(task)}
  ${achieveTask(task)}
`;
};

export const changeManagerModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const tasks = allByType({ gm, type: 'task' });
  return `module ChangeManager
  ${tasks.map(taskDeclaration).join('')}
endmodule`;
};

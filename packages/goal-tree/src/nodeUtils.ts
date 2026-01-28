import type { GoalNode, Resource, Task, TreeNode } from './types/';

const isResource = (node: TreeNode): node is Resource => {
  return node.type === 'resource';
};

const isGoalNode = (node: TreeNode): node is GoalNode => {
  return node.type === 'goal';
};

const isTask = (node: TreeNode): node is Task => {
  return node.type === 'task';
};

export { isResource, isGoalNode, isTask };

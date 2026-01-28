import type { GenericTreeNode, GoalNode, Resource, Task } from './types/';

const isResource = (node: GenericTreeNode): node is Resource => {
  return node.type === 'resource';
};

const isGoalNode = (node: GenericTreeNode): node is GoalNode => {
  return node.type === 'goal';
};

const isTask = (node: GenericTreeNode): node is Task => {
  return node.type === 'task';
};

export { isResource, isGoalNode, isTask };

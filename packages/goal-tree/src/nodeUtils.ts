import type { GenericTree, Resource } from './types';

const isResource = (goal: GenericTree): goal is Resource[] => {
  return goal.every((goal) => goal.type === 'resource');
};

export { isResource };

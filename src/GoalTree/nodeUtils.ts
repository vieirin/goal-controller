import { Node, type GenericTree, type Resource } from './types';

const isAlternative = (goal: Node) => {
  const { alt } = goal.customProperties;
  return alt === 'true' || false;
};

const isResource = (goal: GenericTree): goal is Resource[] => {
  return goal.every((goal) => goal.type === 'resource');
};

export { isAlternative, isResource };

import { Node } from './types';

const isAlternative = (goal: Node) => {
  const { alt } = goal.customProperties;
  return alt === 'true' || false;
};

export { isAlternative };

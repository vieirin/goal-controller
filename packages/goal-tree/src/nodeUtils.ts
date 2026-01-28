import type { GenericTreeNode, Resource } from './types/';

const isResource = (node: GenericTreeNode): node is Resource => {
  return node.type === 'resource';
};

export { isResource };

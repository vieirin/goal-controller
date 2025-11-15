import { readFileSync } from 'fs';
import type { Model } from './types';

const validateModel = ({ model }: { model: Model }) => {
  const root = model.actors
    .map((item) =>
      // check in node list if there are more than one root
      item.nodes.reduce((hasRoot, node) => {
        const isRoot = !model.links.find((link) => link.source === node.id);
        if (isRoot && hasRoot) {
          throw new Error('invalid number of roots, one allowed');
        }
        if (isRoot) {
          node.customProperties.root = 'true';
        }
        return isRoot || hasRoot;
      }, false),
    )
    // check if all actors have a root
    .every((isValid) => isValid);
  if (!root) {
    throw new Error('invalid number of root, one allowed');
  }
};

export const loadPistarModel = ({ filename }: { filename: string }) => {
  const modelFile = readFileSync(filename);
  const model = JSON.parse(modelFile.toString()) as Model;

  validateModel({ model });

  return model;
};

import { readFileSync } from 'fs';
import { Model } from './types';

const validateModel = ({ model }: { model: Model }) => {
  const root = model.actors
    .map((item) =>
      // check in node list if there are more than one root
      item.nodes.reduce((hasRoot, node) => {
        if (hasRoot && node.customProperties.selected) {
          return false;
        }
        return node.customProperties.selected || hasRoot;
      }, false)
    )
    // reduce the actors array to "are all actors valid?"
    .reduce((isValid, actorRootValid) => isValid && actorRootValid, true);
  if (!root) {
    throw new Error('invalid number of root, one allowed');
  }
};

export const loadModel = ({ filename }: { filename: string }) => {
  const modelFile = readFileSync(filename);
  const model = JSON.parse(modelFile.toString()) as Model;

  validateModel({ model });

  return model;
};

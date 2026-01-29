import { GoalTree, Model } from '@goal-controller/goal-tree';
import { writeFile } from 'fs/promises';
import path from 'path';
import {
  edgeEngineMapper,
  generateValidatedPrismModel,
} from '../../engines/edge';
import { initLogger } from '../../engines/edge/logger/logger';

export const runModel = async (
  filePath: string,
  variables: Record<string, boolean | number>,
  clean: boolean = false,
): Promise<void> => {
  const logger = initLogger(filePath);
  try {
    const model = Model.load(filePath);
    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    // last part of the path
    const fileName = filePath.split('/').pop();
    if (!fileName) {
      throw new Error('File name not found');
    }
    const output = generateValidatedPrismModel({
      gm: tree.nodes,
      fileName,
      clean,
      variables,
    });
    await writeFile(`output/${path.parse(fileName).name}.prism`, output);
    console.log('The file was saved successfully!');
  } catch (error) {
    logger.error('Error running model:', error);
    throw error;
  } finally {
    logger.close();
  }
};

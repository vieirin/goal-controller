import { writeFile } from 'fs/promises';
import path from 'path';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { initLogger } from '../../engines/edge/logger/logger';
import { edgeEngineMapper } from '../../engines/edge';
import { generateValidatedPrismModel } from '../../engines/edge';

export const runModel = async (
  filePath: string,
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

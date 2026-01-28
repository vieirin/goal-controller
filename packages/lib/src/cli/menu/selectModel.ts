import { writeFile } from 'fs/promises';
import path from 'path';
import { loadPistarModel } from '@goal-controller/goal-tree';
import { convertToTree } from '@goal-controller/goal-tree';
import { initLogger } from '../../logger/logger';
import { generateValidatedPrismModel } from '../../templateEngine/engine';

export const runModel = async (
  filePath: string,
  clean: boolean = false,
): Promise<void> => {
  const logger = initLogger(filePath);
  try {
    const model = loadPistarModel({ filename: filePath });
    const tree = convertToTree({ model });
    // last part of the path
    const fileName = filePath.split('/').pop();
    if (!fileName) {
      throw new Error('File name not found');
    }
    const output = generateValidatedPrismModel({
      gm: tree,
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

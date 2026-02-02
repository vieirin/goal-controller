import { writeFile } from 'fs/promises';
import path from 'path';
import { loadPistarModel } from '../../GoalTree';
import { convertToTree } from '../../GoalTree/creation';
import { initLogger } from '../../logger/logger';
import { DEFAULT_ACHIEVABILITY_SPACE } from '../../templateEngine/decisionVariables';
import { generateValidatedPrismModel } from '../../templateEngine/engine';

export interface RunModelOptions {
  clean?: boolean;
  generateDecisionVars?: boolean;
  achievabilitySpace?: number;
}

export const runModel = async (
  filePath: string,
  options: RunModelOptions = {},
): Promise<void> => {
  const {
    clean = false,
    generateDecisionVars = true,
    achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
  } = options;

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
      generateDecisionVars,
      achievabilitySpace,
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

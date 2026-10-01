import { GoalTree, Model } from '@goal-controller/goal-tree';
import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import {
  edgeEngineMapper,
  generateValidatedPrismModel,
} from '../../engines/edge';
import { initLogger } from '../../engines/edge/logger/logger';
import { DEFAULT_ACHIEVABILITY_SPACE } from '../../engines/edge/template/decisionVariables';

export interface RunModelOptions {
  clean?: boolean;
  generateDecisionVars?: boolean;
  achievabilitySpace?: number;
  variables?: Record<string, boolean | number>;
}

// Supports both monorepo and direct execution
const readPreviousOutput = (baseName: string): string | undefined => {
  const possiblePaths = [
    `output/${baseName}.prism`, // From project root
    `../../output/${baseName}.prism`, // From packages/lib (monorepo)
  ];
  const oldPrismFilePath = possiblePaths.find((p) => existsSync(p));
  return oldPrismFilePath ? readFileSync(oldPrismFilePath, 'utf8') : undefined;
};

export const runModel = async (
  filePath: string,
  options: RunModelOptions = {},
): Promise<void> => {
  const {
    clean = false,
    generateDecisionVars = true,
    achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
    variables,
  } = options;

  const logger = initLogger(filePath);
  try {
    const model = Model.load(filePath);
    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    // last part of the path
    const fileName = filePath.split('/').pop();
    if (!fileName) {
      throw new Error('File name not found');
    }
    const previousOutput = clean
      ? undefined
      : readPreviousOutput(path.parse(fileName).name);
    const output = generateValidatedPrismModel({
      gm: tree.nodes,
      fileName,
      previousOutput,
      clean,
      variables,
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

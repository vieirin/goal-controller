import { writeFile } from 'fs/promises';
import path from 'path';
import { loadPistarModel } from '../../GoalTree';
import { convertToTree } from '../../GoalTree/creation';
import { initLogger } from '../../logger/logger';
import { edgeDTMCTemplate } from '../../templateEngine/engine';

export const runModel = async (filePath: string): Promise<void> => {
  const logger = initLogger(filePath);
  try {
    const model = loadPistarModel({ filename: filePath });
    const tree = convertToTree({ model });
    // last part of the path
    const fileName = filePath.split('/').pop();
    if (!fileName) {
      throw new Error('File name not found');
    }
    const output = edgeDTMCTemplate({ gm: tree, fileName });
    await writeFile(`output/${path.parse(fileName).name}.mp`, output);
    console.log('The file was saved successfully!');
  } catch (error) {
    logger.error('Error running model:', error);
    throw error;
  } finally {
    logger.close();
  }
};

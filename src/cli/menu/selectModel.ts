import { writeFile } from 'fs/promises';
import path from 'path';
import { edgeDTMCTemplate } from '../../dtmc/template';
import { loadModel } from '../../GoalTree';
import { convertToTree } from '../../GoalTree/creation';

export const runModel = async (filePath: string) => {
  try {
    const model = loadModel({ filename: filePath });
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
    console.error('Error running model:', error);
  }
};

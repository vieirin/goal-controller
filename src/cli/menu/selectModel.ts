import { writeFile } from 'fs/promises';
import { edgeDTMCTemplate } from '../../dtmc/template';
import { loadModel } from '../../ObjectiveTree';
import { convertToTree } from '../../ObjectiveTree/creation';

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
    await writeFile('output/edge.mp', output);
    console.log('The file was saved successfully!');
  } catch (error) {
    console.error('Error running model:', error);
  }
};

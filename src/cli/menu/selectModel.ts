import { writeFile } from 'fs/promises';
import { edgeDTMCTemplate } from '../../dtmc/template';
import { loadModel } from '../../ObjectiveTree';
import { convertToTree } from '../../ObjectiveTree/creation';

export const runModel = async (filePath: string) => {
  try {
    const model = loadModel({ filename: filePath });
    const tree = convertToTree({ model });
    const output = edgeDTMCTemplate({ gm: tree });
    console.log(output);
    await writeFile('output/edge.mp', output);
    console.log('The file was saved successfully!');
  } catch (error) {
    console.error('Error running model:', error);
  }
};

import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { egdeMDPTemplate } from './mdp/template';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}

const model = loadModel({ filename: process.argv[2] });
const tree = convertToTree({ model });

// printTree(tree);

console.log(egdeMDPTemplate({ gm: tree }));
egdeMDPTemplate({ gm: tree });

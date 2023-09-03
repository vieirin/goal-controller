import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { printTree } from './ObjectiveTree/printTree';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}

const model = loadModel({ filename: process.argv[2] });
const tree = convertToTree({ model });

printTree(tree);

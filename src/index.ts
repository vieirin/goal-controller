import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}

const model = loadModel({ filename: process.argv[2] });
const tree = convertToTree({ model });

console.log(tree);

tree[0]?.children?.forEach((element) => {
  console.log(element);
});

import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { GoalNode } from './ObjectiveTree/types';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}

const model = loadModel({ filename: process.argv[2] });
const tree = convertToTree({ model });

console.log(tree);
let level = 2;
let children = tree[0]?.children;
while ((children?.length ?? 0) > 0) {
  let newChildren: GoalNode[] = [];
  console.log('=== children ===', { level });
  children?.forEach((element) => {
    console.log(element);
    if (element.children) {
      newChildren = [...newChildren, ...element.children];
    }
  });
  children = [...newChildren];
}

import { GoalNode } from './types';

export const printTree = (tree: GoalNode[]) => {
  let level = 1;
  console.log(tree);
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
};

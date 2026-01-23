"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTree = void 0;
const printTree = (tree) => {
    let level = 1;
    console.log(tree);
    let children = tree[0]?.children;
    while ((children?.length ?? 0) > 0) {
        let newChildren = [];
        console.log('=== children ===', { level });
        children?.forEach((element) => {
            console.log(element);
            if (element.children) {
                newChildren = [...newChildren, ...element.children];
            }
        });
        level += 1;
        children = [...newChildren];
    }
};
exports.printTree = printTree;
//# sourceMappingURL=printTree.js.map
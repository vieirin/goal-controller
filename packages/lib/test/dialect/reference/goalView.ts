// goal-tree's view as the reference reads it: its construct is an RtConstruct
// (scripts/sync-reference.sh; do not edit)
import type {
  GoalView as TreeView,
  GoalViewNode as TreeNode,
} from '@goal-controller/goal-tree';
import type { RtConstruct } from './constructs';

export type GoalViewNode = Omit<TreeNode, 'construct'> & {
  construct: RtConstruct | null;
};
export type GoalView = Omit<TreeView, 'nodes' | 'byIStarId'> & {
  nodes: Map<string, GoalViewNode>;
  byIStarId: Map<string, GoalViewNode>;
};

/**
 * Goal Tree SDK
 *
 * A class-based SDK for working with iStar goal models.
 *
 * @example
 * ```typescript
 * import { GoalTree, Node, Model } from '@goal-controller/goal-tree';
 *
 * // Create a tree from a file
 * const tree = GoalTree.fromFile('model.json');
 *
 * // Query operations
 * const allGoals = tree.query.allByType('goal');
 * const leafGoals = tree.query.leafGoals();
 *
 * // Node utilities
 * if (Node.isGoal(node)) {
 *   const children = Node.children(node);
 * }
 *
 * // Model utilities
 * const model = Model.load('file.json');
 * Model.validate(model);
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Main SDK Classes
// ─────────────────────────────────────────────────────────────────────────────

export { GoalTree, type TreeQuery } from './GoalTree';
export { Model, type ModelNamespace } from './Model';
export { Node, type NodeNamespace } from './Node';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // iStar types
  Actor,
  Decision,
  // Props types
  ExecCondition,
  GoalEdgeProps,
  GoalExecutionDetail,
  // Goal Tree types
  GoalNode,
  GoalTree as GoalTreeType,
  Model as IStarModel,
  Node as IStarNode,
  Link,
  NodeType,
  Relation,
  Resource,
  SleecProps,
  Task,
  TaskEdgeProps,
  TaskSleecProps,
  TreeNode,
  Type
} from './types/';

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities (exported for advanced use cases)
// ─────────────────────────────────────────────────────────────────────────────

export { cartesianProduct } from './internal/utils';

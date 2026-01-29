/**
 * Goal Tree SDK
 *
 * A class-based SDK for working with iStar goal models.
 *
 * @example
 * ```typescript
 * import { GoalTree, Node, Model, type EngineMapper } from '@goal-controller/goal-tree';
 *
 * // Define your engine mapper
 * const myMapper: EngineMapper<MyGoalEngine, MyTaskEngine> = {
 *   mapGoalProps: (props) => ({ ... }),
 *   mapTaskProps: (props) => ({ ... }),
 * };
 *
 * // Create a tree from a file with your engine
 * const tree = GoalTree.fromFile('model.json', myMapper);
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

export {
  GoalTree,
  createEngineMapper,
  type TreeQuery,
  type EngineMapper,
} from './GoalTree';
export { Model, type ModelNamespace } from './Model';
export { Node, type NodeNamespace } from './Node';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // iStar types
  Actor,
  // Goal Tree types
  GoalNode,
  GoalTree as GoalTreeType,
  Model as IStarModel,
  Node as IStarNode,
  Link,
  NodeType,
  Relation,
  Resource,
  Task,
  TreeNode,
  Type,
  BaseNode,
} from './types/';

// ─────────────────────────────────────────────────────────────────────────────
// Raw prop types for engine mappers
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Generic raw props type
  RawProps,
  // Discriminated union for afterCreationMapper
  RawPropertiesUnion,
  GoalExecutionDetail,
} from './internal/creation';

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities (exported for advanced use cases)
// ─────────────────────────────────────────────────────────────────────────────

export { cartesianProduct } from './internal/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Parsers (for engine mappers)
// ─────────────────────────────────────────────────────────────────────────────

export { getAssertionVariables } from './parsers/getAssertionVariables';

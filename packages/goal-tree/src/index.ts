/**
 * Goal Tree SDK
 *
 * A class-based SDK for working with iStar goal models. This package provides tools
 * for parsing iStar models, transforming them into goal trees with custom engine properties,
 * and querying the resulting tree structures.
 *
 * ## Key Concepts
 *
 * ### Instance Methods vs Static Methods
 * - **Instance methods** (via `tree.query.*`): Use when you have a GoalTree instance
 * - **Static methods** (via `GoalTree.*`): Use when working with raw node arrays
 *
 * ### Query Interface
 * The `tree.query` interface provides convenient access to tree traversal operations:
 * - `allByType()` - Get nodes by type (goal, task, or resource)
 * - `allGoalsMap()` - Get a map of goal IDs to nodes
 * - `leafGoals()` - Get goals that have tasks
 * - `contextVariables()` - Extract variables from execution conditions
 * - `taskAchievabilityVariables()` - Get task achievability variable names
 *
 * ### Type Parameter Conventions
 * GoalTree uses three type parameters consistently throughout:
 * - `TGoalEngine` - Type of engine-specific properties for goals
 * - `TTaskEngine` - Type of engine-specific properties for tasks
 * - `TResourceEngine` - Type of engine-specific properties for resources (optional)
 *
 * @example
 * ```typescript
 * import { GoalTree, Node, Model, createEngineMapper } from '@goal-controller/goal-tree';
 *
 * // Define engine mapper with type inference
 * const myMapper = createEngineMapper({
 *   allowedGoalKeys: ['utility', 'cost'] as const,
 *   allowedTaskKeys: ['maxRetries'] as const,
 *   skipResource: true,
 * })({
 *   mapGoalProps: ({ raw }) => ({ utility: raw.utility || '' }),
 *   mapTaskProps: ({ raw }) => ({ retries: parseInt(raw.maxRetries || '0') }),
 * });
 *
 * // Create a tree from a file with your engine
 * const tree = GoalTree.fromFile('model.json', myMapper);
 *
 * // Query operations using instance methods (preferred)
 * const allGoals = tree.query.allByType('goal');
 * const leafGoals = tree.query.leafGoals();
 *
 * // Static methods for raw arrays
 * const tasks = GoalTree.allByType(tree.nodes, 'task');
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

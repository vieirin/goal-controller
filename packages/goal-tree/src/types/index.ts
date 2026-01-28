/**
 * Type definitions for goal-tree package
 *
 * Organized into:
 * - istar.ts: Types for iStar models (from piStar tool)
 * - goalTree.ts: Types for goal tree structures
 */

// Re-export all iStar types
export type {
  id,
  NodeType,
  CustomProperties,
  Node,
  Actor,
  Link,
  Display,
  DisplayItem,
  Diagram,
  Model,
} from './istar';

// Re-export all Goal Tree types
export type {
  Relation,
  Type,
  ExecCondition,
  Decision,
  GoalExecutionDetail,
  SleecProps,
  TaskEdgeProps,
  TaskSleecProps,
  GoalEdgeProps,
  BaseNode,
  GoalNode,
  Task,
  Resource,
  TreeNode,
  GoalTree,
} from './goalTree';

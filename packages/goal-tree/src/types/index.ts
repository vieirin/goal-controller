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
  CustomPropertiesData,
  Node,
  Actor,
  Link,
  Model,
  AnyModel,
  ForeignElementKind,
  FrameworkOf,
  ModelFor,
} from './istar';

// Re-export all Goal Tree types
export type {
  Relation,
  Type,
  TraversalNode,
  TraversalParent,
  GoalExecutionDetail,
} from './goalTree';

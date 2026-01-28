/**
 * Node namespace - Utilities for working with individual tree nodes
 */
import {
  childrenWithMaxRetries as _childrenWithMaxRetries,
  childrenWithTasksAndResources,
} from './internal/traversal';
import { goalRootId as _goalRootId } from './internal/utils';
import type { GoalNode, Resource, Task, TreeNode } from './types/';

/**
 * Node namespace containing type guards and node utilities
 */
export const Node = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Type Guards
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a node is a GoalNode
   */
  isGoal(node: TreeNode): node is GoalNode {
    return node.type === 'goal';
  },

  /**
   * Check if a node is a Task
   */
  isTask(node: TreeNode): node is Task {
    return node.type === 'task';
  },

  /**
   * Check if a node is a Resource
   */
  isResource(node: TreeNode): node is Resource {
    return node.type === 'resource';
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Node Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all children of a node (including tasks and resources)
   */
  children(node: GoalNode | Task): TreeNode[] {
    return childrenWithTasksAndResources(node);
  },

  /**
   * Get children that have retry configuration (maxRetries > 0)
   */
  childrenWithRetries(node: GoalNode): Array<GoalNode | Task> {
    return _childrenWithMaxRetries(node);
  },

  /**
   * Extract the root ID from a goal ID (e.g., "G1a" -> "G1")
   */
  rootId(id: string): string {
    return _goalRootId(id);
  },
} as const;

// Export type for the namespace
export type NodeNamespace = typeof Node;

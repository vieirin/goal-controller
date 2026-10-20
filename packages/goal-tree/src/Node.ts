/**
 * Node namespace - Utilities for working with individual tree nodes
 */
import {
  childrenWithMaxRetries as _childrenWithMaxRetries,
  childrenWithTasksAndResources,
} from './internal/traversal';
import { goalRootId as _goalRootId } from './internal/utils';
import type { TraversalNode, TraversalParent } from './types/';

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
  isGoal<N extends TraversalNode>(
    node: N,
  ): node is Extract<N, { type: 'goal' }> {
    return node.type === 'goal';
  },

  /**
   * Check if a node is a Task
   */
  isTask<N extends TraversalNode>(
    node: N,
  ): node is Extract<N, { type: 'task' }> {
    return node.type === 'task';
  },

  /**
   * Check if a node is a Resource
   */
  isResource<N extends TraversalNode>(
    node: N,
  ): node is Extract<N, { type: 'resource' }> {
    return node.type === 'resource';
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Node Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all children of a node (including tasks and resources)
   */
  children(node: TraversalParent): TraversalNode[] {
    return childrenWithTasksAndResources(node);
  },

  /**
   * Get children that have retry configuration (maxRetries > 0).
   * Only each child's `properties.engine.maxRetries` is read.
   */
  childrenWithRetries(
    node: TraversalParent & { type: 'goal' },
  ): TraversalNode[] {
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

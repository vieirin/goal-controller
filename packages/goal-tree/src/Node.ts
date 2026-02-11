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
  isGoal<TGoalEngine, TTaskEngine, TResourceEngine>(
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): node is GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> {
    return node.type === 'goal';
  },

  /**
   * Check if a node is a Task
   */
  isTask<TGoalEngine, TTaskEngine, TResourceEngine>(
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): node is Task<TTaskEngine, TResourceEngine> {
    return node.type === 'task';
  },

  /**
   * Check if a node is a Resource
   */
  isResource<TGoalEngine, TTaskEngine, TResourceEngine>(
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): node is Resource<TResourceEngine> {
    return node.type === 'resource';
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Node Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all children of a node (including tasks and resources)
   */
  children<TGoalEngine, TTaskEngine, TResourceEngine>(
    node:
      | GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
      | Task<TTaskEngine, TResourceEngine>,
  ): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>[] {
    return childrenWithTasksAndResources(node);
  },

  /**
   * Get children that have retry configuration (maxRetries > 0)
   * Requires engine props to have maxRetries field
   */
  childrenWithRetries<
    TGoalEngine extends { maxRetries: number },
    TTaskEngine extends { maxRetries: number },
    TResourceEngine,
  >(
    node: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): Array<
    | GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
    | Task<TTaskEngine, TResourceEngine>
  > {
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

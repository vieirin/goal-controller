/**
 * Node namespace - Utilities for working with individual tree nodes.
 * Accepts both the per-role TreeNode shapes and KindNode (goal-controller#215).
 */
import { goalRootId as _goalRootId } from './internal/utils';

/** What Node's helpers need of a child: its type and id. */
export type NodeChild = { type: string; id: string };

type WithEngineRetries = NodeChild & {
  properties: { engine: { maxRetries: number } };
};

/**
 * Node namespace containing type guards and node utilities
 */
export const Node = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Type Guards
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether the node is named a goal (includes Qualities under the iStar reading). */
  isGoal<T extends { type: string }>(node: T): node is T & { type: 'goal' } {
    return node.type === 'goal';
  },

  /** Whether the node is a task. */
  isTask<T extends { type: string }>(node: T): node is T & { type: 'task' } {
    return node.type === 'task';
  },

  /** Whether the node is a resource. */
  isResource<T extends { type: string }>(
    node: T,
  ): node is T & { type: 'resource' } {
    return node.type === 'resource';
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Node Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * All children of a node (goals, tasks and resources under the iStar reading).
   */
  children(node: {
    children?: readonly NodeChild[];
    tasks?: readonly NodeChild[];
    resources?: readonly NodeChild[];
  }): NodeChild[] {
    return [
      ...(node.children ?? []),
      ...(node.tasks ?? []),
      ...(node.resources ?? []),
    ];
  },

  /**
   * Children that have retry configuration (maxRetries > 0).
   */
  childrenWithRetries(node: {
    children?: readonly WithEngineRetries[];
    tasks?: readonly WithEngineRetries[];
  }): WithEngineRetries[] {
    return Node.children(node).filter(
      (child): child is WithEngineRetries =>
        child.type !== 'resource' &&
        'properties' in child &&
        (child as WithEngineRetries).properties.engine.maxRetries > 0,
    );
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

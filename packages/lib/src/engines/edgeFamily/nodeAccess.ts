/**
 * Kind-entry nodes (no `isQuality`) are enough for goal-tree's Node helpers at
 * runtime; those helpers are still typed for the per-role GoalNode. Cast once
 * here so edge/edgeV2 templates stay readable.
 */
import { Node } from '@goal-controller/goal-tree';

type AnyNode = { type: string; id: string };

export const edgeChildren = <T extends AnyNode>(node: T): AnyNode[] =>
  Node.children(node as never) as AnyNode[];

export const edgeChildrenWithRetries = <T extends AnyNode>(
  node: T,
): AnyNode[] => Node.childrenWithRetries(node as never) as AnyNode[];

export const edgeIsResource = (node: AnyNode): boolean =>
  Node.isResource(node as never);

export const edgeIsTask = <T extends AnyNode>(
  node: T,
): node is T & { type: 'task' } => Node.isTask(node as never);

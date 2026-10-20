/**
 * Types for Goal Tree
 * What every tree shares, whatever its mapper: the relations, the node types
 * the iStar reading names, and the shape traversal reads. The nodes and the
 * IR are typed by kind (`kindTree.ts`, goal-controller#215).
 */

import type { ExecutionDetail } from '@goal-controller/goal-language';

export type Relation = 'or' | 'and' | 'neededBy' | 'none';

export type Type = 'goal' | 'task' | 'resource';

/**
 * What a goal's notation makes it do (the goal language's reading, in the
 * engine's dialect): its construct, its operands' ids in the order written,
 * and the arguments of the modifiers that apply (`{ retry: { G2: 3 } }`).
 */
export type GoalExecutionDetail = ExecutionDetail;

/**
 * A node shape that traversal and `Node` helpers accept: a kind-entry
 * tree's nodes (`KindNode`) and hand-built ones.
 */
export type TraversalNode = {
  type: string;
  id: string;
  kind?: string;
  children?: TraversalNode[];
  tasks?: TraversalNode[];
  resources?: TraversalNode[];
  properties?: { engine?: unknown };
};

/** A goal or task node that may hold refinement children. */
export type TraversalParent = TraversalNode & {
  type: 'goal' | 'task';
};

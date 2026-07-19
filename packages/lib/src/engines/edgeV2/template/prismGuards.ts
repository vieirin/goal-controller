/**
 * Shared Edge V2 PRISM guard string builders.
 *
 * A single source of truth for the snippet `achievable * 10.0 > decision` /
 * `<= decision` pattern and for "child is idle" guards so they cannot drift
 * across skip, pursue, and validator files.
 */
import { Node } from '@goal-controller/goal-tree';
import type { TreeNode } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../types';
import { achievable, goalState, pursued } from '../mdp/common';
import { decisionVariable } from './common';

/** Scale factor shared across all EDGE snippet pursue/skip guards. */
export const ACHIEVABILITY_DECISION_SCALE = 10.0;

/** `child_achievable*10.0 > decision_child` (used in pursue guards). */
export const achievableGtDecision = (id: string): string =>
  `${achievable(id)}*${ACHIEVABILITY_DECISION_SCALE} > ${decisionVariable(id)}`;

/** `child_achievable*10.0 <= decision_child` (used in skip guards). */
export const achievableLeDecision = (id: string): string =>
  `${achievable(id)}*${ACHIEVABILITY_DECISION_SCALE} <= ${decisionVariable(id)}`;

/**
 * "This node is not currently being pursued":
 * - task → `task_pursued=0`
 * - goal → `goal_state=0`
 */
export const childIdle = (child: TreeNode | EdgeGoalNode | EdgeTask): string =>
  child.type === 'task' ? `${pursued(child.id)}=0` : `${goalState(child.id)}=0`;

/**
 * Ordered list of pursueable (non-resource) children for a goal.
 * Stable because `Node.children` preserves declaration order.
 */
export const pursueableChildren = (
  goal: EdgeGoalNode,
): Array<EdgeGoalNode | EdgeTask> =>
  Node.children(goal).filter(
    (c): c is EdgeGoalNode | EdgeTask => !Node.isResource(c),
  );

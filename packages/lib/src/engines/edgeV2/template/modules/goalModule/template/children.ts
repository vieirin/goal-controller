import { constructsWith } from '@goal-controller/dialect';
import { edgeV2 } from '../../../../definition';
import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../types';
import { getLogger } from '../../../../logger/logger';

export type PursueableNode = EdgeGoalNode | EdgeTask;

/**
 * Semantics of a goal module, named after the EDGE reference constructs:
 *   sequence    → fixed           [G1;G2]
 *   anyOrder    → flexible        [G1+G2]
 *   interleaved → interleaved     [G1#G2]   (also AND goals without notation)
 *   alternative → non-idempotent  [G1|G2]   (also OR goals without notation)
 *   choice      → committed       [G1?G2]
 *   degradation → preferred       [G1@3->G2]
 */
export type Construct =
  | 'sequence'
  | 'anyOrder'
  | 'interleaved'
  | 'alternative'
  | 'choice'
  | 'degradation';

// which links each construct needs, and the default for each: the definition's
const CONSTRUCTS_WITH = {
  and: constructsWith(edgeV2, 'and'),
  or: constructsWith(edgeV2, 'or'),
};

// keyed by goal object, so each model (and each run in a long-lived process) warns again
const warned = new WeakMap<EdgeGoalNode, Set<string>>();
/** Log a model inconsistency once per goal and message (the model is still generated). */
const warnOnce = (goal: EdgeGoalNode, message: string): void => {
  const seen = warned.get(goal) ?? new Set<string>();
  if (seen.has(message)) {
    return;
  }
  seen.add(message);
  warned.set(goal, seen);
  getLogger().info(`[WARNING] ${message}`, 0);
};

/**
 * The refinement links decide AND vs OR. A notation that contradicts them
 * (e.g. `[G1#G2]` over OR links) is ignored, as before, and the goal gets the
 * default construct for its links.
 */
export const construct = (goal: EdgeGoalNode): Construct => {
  const type = goal.properties.engine.executionDetail?.type;
  const relation = goal.relationToChildren;
  const fallback =
    edgeV2.notation.defaultConstruct[relation === 'or' ? 'or' : 'and'];
  if (!type || type === 'decisionMaking') {
    return fallback;
  }
  const allowed: readonly string[] =
    CONSTRUCTS_WITH[relation === 'or' ? 'or' : 'and'];
  if (!allowed.includes(type)) {
    warnOnce(
      goal,
      `Goal ${goal.id} uses ${type} notation but refines its children with ${relation ?? 'no'} links; the notation is ignored and the goal is treated as ${fallback}`,
    );
    return fallback;
  }
  return type as Construct;
};

/** The children's order the notation writes, if it writes one. */
const notationOrder = (goal: EdgeGoalNode): string[] | undefined => {
  const ids = goal.properties.engine.executionDetail?.ids;
  return ids?.length ? ids : undefined;
};

/**
 * Pursueable children (goals and tasks) in notation order — the order is the
 * priority used by sequence, child selection and degradation. Goals without
 * notation keep the model's link order; a notation that does not match the
 * children is repaired with a warning (unknown ids dropped, unlisted appended).
 */
export const orderedChildren = (goal: EdgeGoalNode): PursueableNode[] => {
  const children = Node.children(goal).filter(
    (child): child is PursueableNode => !Node.isResource(child),
  );
  const order = notationOrder(goal);
  if (!order) {
    return children;
  }
  const byId = new Map(children.map((child) => [child.id, child]));
  const unknown = order.filter((id) => !byId.has(id));
  const missing = children.filter((child) => !order.includes(child.id));
  if (unknown.length > 0 || missing.length > 0) {
    warnOnce(
      goal,
      `Goal ${goal.id} notation lists [${order.join(', ')}] but its children are [${children.map((c) => c.id).join(', ')}]` +
        (unknown.length
          ? `; ignoring non-children ${unknown.join(', ')}`
          : '') +
        (missing.length
          ? `; appending unlisted ${missing.map((c) => c.id).join(', ')}`
          : ''),
    );
  }
  const listed = order.flatMap((id) => {
    const child = byId.get(id);
    return child ? [child] : [];
  });
  return [...listed, ...missing];
};

export const orderedChildIds = (goal: EdgeGoalNode): string[] =>
  orderedChildren(goal).map((child) => child.id);

/** Goals that pick one child by relative achievability vs `_decision_G<id>`. */
export const usesChildSelection = (goal: EdgeGoalNode): boolean =>
  ['anyOrder', 'alternative', 'choice', 'degradation'].includes(
    construct(goal),
  );

/**
 * Degradation retry chain: children that are retried before the goal falls
 * back to choosing among all children, in notation order with their retry
 * limit. `[G1@3->G2]` retries G1 up to 3 times (the reference `preferred`).
 * Retries come from the notation (`@n`) or the child's maxRetries property.
 */
export const retriedChildren = (
  goal: EdgeGoalNode,
): Array<{ id: string; retries: number }> => {
  if (construct(goal) !== 'degradation') {
    return [];
  }
  const retryMap =
    goal.properties.engine.executionDetail?.type === 'degradation'
      ? (goal.properties.engine.executionDetail.modifiers.retry ?? {})
      : {};
  return orderedChildren(goal)
    .map((child) => {
      const fromNotation = retryMap[child.id];
      const retries =
        typeof fromNotation === 'number' && fromNotation > 0
          ? fromNotation
          : child.properties.engine.maxRetries;
      return { id: child.id, retries };
    })
    .filter(
      (entry): entry is { id: string; retries: number } =>
        typeof entry.retries === 'number' &&
        Number.isInteger(entry.retries) &&
        entry.retries > 0,
    );
};

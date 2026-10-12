/** A goal model's view for the pool's tests: some elements' properties set. */
import type { GoalView } from '@goal-controller/goal-tree';

export const withProperties = (
  view: GoalView,
  edits: Record<string, Record<string, string>>,
): GoalView => ({
  ...view,
  nodes: new Map(
    [...view.nodes].map(([key, node]) => [
      key,
      edits[key]
        ? { ...node, properties: { ...node.properties, ...edits[key] } }
        : node,
    ]),
  ),
});

/**
 * The variables an Edge engine's PRISM model leaves open (goal-controller#124
 * follow-up): the context variables its goals' and tasks' conditions read,
 * and each task's achievability, with the nodes that use each one.
 */
import { GoalTree } from '@goal-controller/goal-tree';
import type { EngineVariable } from '../run';

type WithCondition = {
  id: string;
  properties: {
    engine?: {
      execCondition?: {
        assertion?: { variables?: Array<{ name: string }> };
        maintain?: { variables?: Array<{ name: string }> };
      };
    };
  };
};

/** An Edge engine's open variables, from the tree its mapper reads. */
export const edgeVariables = (tree: readonly unknown[]): EngineVariable[] => {
  const nodes = tree as Parameters<typeof GoalTree.contextVariables>[0];
  const conditioned = [
    ...GoalTree.allByType(nodes, 'goal'),
    ...GoalTree.allByType(nodes, 'task'),
  ] as unknown as WithCondition[];
  const usedBy = (variable: string): string[] =>
    conditioned
      .filter((node) => {
        const condition = node.properties.engine?.execCondition;
        return [
          ...(condition?.assertion?.variables ?? []),
          ...(condition?.maintain?.variables ?? []),
        ].some((v) => v.name === variable);
      })
      .map((node) => node.id);
  return [
    ...GoalTree.contextVariables(nodes).map((name) => ({
      name,
      kind: 'context' as const,
      usedBy: usedBy(name),
    })),
    ...GoalTree.taskAchievabilityVariables(nodes).map((name) => ({
      name,
      kind: 'achievability' as const,
      usedBy: [name.replace(/_achievable$/, '')],
    })),
  ];
};

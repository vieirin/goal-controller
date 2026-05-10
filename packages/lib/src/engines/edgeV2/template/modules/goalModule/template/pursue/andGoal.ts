import type { TreeNode } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import { separator } from '../../../../../mdp/common';
import { hasBeenAchieved } from './common';

// Type for nodes that can be achieved (goals and tasks, but not resources)
type AchievableNode = EdgeGoalNode | EdgeTask;

export const splitSequence = (
  sequence: string[],
  childId: string,
): [string[], string[]] => {
  if (!sequence.includes(childId)) {
    throw new Error(
      `Child ID ${childId} not found in sequence ${sequence.join(', ')}`,
    );
  }
  const sequenceIndex = sequence.indexOf(childId);
  return [sequence.slice(0, sequenceIndex), sequence.slice(sequenceIndex + 1)];
};

export const pursueAndSequentialGoal = (
  goal: EdgeGoalNode,
  sequence: string[],
  childId: string,
  children: TreeNode[],
): string => {
  if (goal.relationToChildren === 'or') {
    throw new Error(
      'OR relation to children without a runtime notation is not supported use Degradation goal instead',
    );
  }

  const [leftGoals, rightGoals] = splitSequence(sequence, childId);

  if (!goal.relationToChildren) {
    return '';
  }

  // Filter out resources - they cannot be achieved
  const achievableChildren = children.filter(
    (child): child is AchievableNode => !Node.isResource(child),
  );

  const childrenMap = new Map<string, AchievableNode>(
    achievableChildren.map((child) => [child.id, child]),
  );

  const resolveAndGoal = (): string => {
    if (leftGoals.length === 0) {
      const child = childrenMap.get(childId);
      if (!child) {
        throw new Error(
          `Child with ID ${childId} not found in children map for goal ${goal.id}`,
        );
      }
      return hasBeenAchieved(child, { condition: false });
    }

    return [
      ...leftGoals.map((goalId) => {
        const child = childrenMap.get(goalId);
        if (!child) {
          throw new Error(
            `Child with ID ${goalId} not found in children map for goal ${goal.id}`,
          );
        }
        return hasBeenAchieved(child, { condition: true });
      }),
      ...rightGoals.map((goalId) => {
        const child = childrenMap.get(goalId);
        if (!child) {
          throw new Error(
            `Child with ID ${goalId} not found in children map for goal ${goal.id}`,
          );
        }
        return hasBeenAchieved(child, { condition: false });
      }),
    ].join(separator('and'));
  };

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, rightGoals);

  if (goal.relationToChildren === 'and') {
    return resolveAndGoal();
  }

  return '';
};

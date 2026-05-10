import type { TreeNode } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { getLogger } from '../../../../../logger/logger';
import { achievable, achieved, separator } from '../../../../../mdp/common';
import { decisionVariable } from '../../../../common';
import { hasBeenAchieved } from './common';

// Type for nodes that can be achieved (goals and tasks, but not resources)
type AchievableNode = EdgeGoalNode | EdgeTask;

/** Snippets use `G1_achieved` on sequential pursues; maintain goals still expose `G*_achieved`. */
const priorSequentialSiblingGuard = (node: AchievableNode): string =>
  node.type === 'task'
    ? hasBeenAchieved(node, { condition: true })
    : achieved(node.id);

/** Matches EDGE snippets: `G0_achievable*10.0 > decision_G0`. */
const ACHIEVABILITY_DECISION_SCALE = 10.0;

/** Interleaved AND: per-child guard from snippets (`G1_achievable*10.0 > decision_G1`). */
export const pursueAndInterleavedGoal = (childId: string): string =>
  `${achievable(childId)}*${ACHIEVABILITY_DECISION_SCALE} > ${decisionVariable(childId)}`;

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

  const { sequence: sequenceLogger } = getLogger().pursue.executionDetail;
  sequenceLogger(goal.id, childId, leftGoals, rightGoals);

  if (goal.relationToChildren === 'and') {
    const decisionGuard = `${achievable(goal.id)}*${ACHIEVABILITY_DECISION_SCALE} > ${decisionVariable(goal.id)}`;
    const previousAchieved = leftGoals.map((id) => {
      const node = childrenMap.get(id);
      if (!node) {
        throw new Error(
          `Child with ID ${id} not found in children map for goal ${goal.id}`,
        );
      }
      return priorSequentialSiblingGuard(node);
    });
    return [decisionGuard, ...previousAchieved].join(separator('and'));
  }

  return '';
};

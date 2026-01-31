import type { GoalTreeType, GoalNode } from '@goal-controller/goal-tree';
import { GoalTree } from '@goal-controller/goal-tree';
import type { SleecGoalProps, SleecTaskProps } from '../types';

type SleecGoalNode = GoalNode<SleecGoalProps, SleecTaskProps>;
type SleecGoalTree = GoalTreeType<SleecGoalProps, SleecTaskProps>;

export const generatePurposes = (tree: SleecGoalTree): string => {
  const goals = GoalTree.allByType(tree, 'goal');
  return `purpose_start
  ${goals
    .filter((goal: SleecGoalNode) =>
      ['Achieve', 'Maintain'].includes(goal.properties.engine?.Type || ''),
    )
    .map((purpose: SleecGoalNode, index: number) => {
      const purposeLabel = `P${index + 1}`;

      const {
        Condition: condition,
        Event: event,
        ContextEvent: contextEvent,
      } = purpose.properties.engine || {};
      if (!condition || !event || !contextEvent) {
        throw new Error(
          `Purpose ${purpose.name} has no condition, event or contextEvent property`,
        );
      }
      if (purpose.properties.engine?.Type === 'Achieve') {
        return `${purposeLabel} when ${contextEvent} and ${condition} then ${event}`;
      }
      return `${purposeLabel} exists ${event} and ${condition} while ${contextEvent}`;
    })
    .join('\n')}
purpose_end`;
};


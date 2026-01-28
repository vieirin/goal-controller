import type { GoalTreeType, GoalNode } from '@goal-controller/goal-tree';
import { GoalTree } from '@goal-controller/goal-tree';

export const generatePurposes = (tree: GoalTreeType): string => {
  const goals = GoalTree.allByType(tree, 'goal');
  return `purpose_start
  ${goals
    .filter((goal: GoalNode) =>
      ['Achieve', 'Maintain'].includes(goal.properties.sleec?.Type || ''),
    )
    .map((purpose: GoalNode, index: number) => {
      const purposeLabel = `P${index + 1}`;

      const {
        Condition: condition,
        Event: event,
        ContextEvent: contextEvent,
      } = purpose.properties.sleec || {};
      if (!condition || !event || !contextEvent) {
        throw new Error(
          `Purpose ${purpose.name} has no condition, event or contextEvent property`,
        );
      }
      if (purpose.properties.sleec?.Type === 'Achieve') {
        return `${purposeLabel} when ${contextEvent} and ${condition} then ${event}`;
      }
      return `${purposeLabel} exists ${event} and ${condition} while ${contextEvent}`;
    })
    .join('\n')}
purpose_end`;
};

import type { GoalTree, GoalNode } from '@goal-controller/goal-tree';
import { allByType } from '@goal-controller/goal-tree';

export const generatePurposes = (tree: GoalTree): string => {
  const goals = allByType({ gm: tree, type: 'goal' });
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

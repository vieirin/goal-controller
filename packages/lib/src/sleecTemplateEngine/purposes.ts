import type { GoalTree } from '../GoalTree/types';
import { allByType } from '../GoalTree/utils';

export const generatePurposes = (tree: GoalTree): string => {
  const goals = allByType({ gm: tree, type: 'goal' });
  return `purpose_start
  ${goals
    .filter((goal) =>
      ['Achieve', 'Maintain'].includes(goal.sleecProps?.Type || ''),
    )
    .map((purpose, index) => {
      const purposeLabel = `P${index + 1}`;

      const {
        Condition: condition,
        Event: event,
        ContextEvent: contextEvent,
      } = purpose.sleecProps || {};
      if (!condition || !event || !contextEvent) {
        throw new Error(
          `Purpose ${purpose.name} has no condition, event or contextEvent property`,
        );
      }
      if (purpose.sleecProps?.Type === 'Achieve') {
        return `${purposeLabel} when ${contextEvent} and ${condition} then ${event}`;
      }
      return `${purposeLabel} exists ${event} and ${condition} while ${contextEvent}`;
    })
    .join('\n')}
purpose_end`;
};

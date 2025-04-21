import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';

export const systemModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const allGoals = allByType({ gm, type: 'goal' });
  return `
module System
  ${allGoals
    .map((goal) => {
      if (goal.maintainCondition?.assertion) {
        return `${goal.maintainCondition.assertion}: bool init false`;
      }
      return '';
    })
    .join('\n  ')
    .trim()}
endmodule
  `;
};

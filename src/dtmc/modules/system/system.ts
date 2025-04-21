import { treeVariables } from '../../../ObjectiveTree/treeVariables';
import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';

export const systemModule = ({ gm }: { gm: GoalTreeWithParent }) => {
  const variables = treeVariables(gm);
  return `
module System
  ${variables
    .map((variable) => {
      return `${variable}: bool init false`;
    })
    .join('\n  ')
    .trim()}
endmodule
  `;
};

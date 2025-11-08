import { GoalNodeWithParent } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';
import { achieveStatement } from './achieve';
import { achievableGoalFormula, maintainConditionFormula } from './formulas';

import { pursueStatements } from './pursue';
import { skipStatement } from './skip';
import { variablesDefinition } from './variables';

export const goalModule = (goal: GoalNodeWithParent) => {
  const logger = getLogger();
  logger.initGoal(goal);

  return `module ${goal.id}
  ${variablesDefinition(goal)}

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}
endmodule

${maintainConditionFormula(goal)}
${achievableGoalFormula(goal)}
`.trim();
};

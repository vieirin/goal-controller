import { getLogger } from '../../../../logger/logger';
import { achieveStatement } from './achieve';
import { achievableGoalFormula, maintainConditionFormula } from './formulas';

import type { GoalNode } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import { pursueStatements } from './pursue';
import { skipStatement } from './skip';
import { variablesDefinition } from './variables';

export const goalModule = (goal: GoalNode): string => {
  const logger = getLogger();
  logger.initGoal(goal);

  const formulaStatements = [
    maintainConditionFormula(goal),
    achievableGoalFormula(goal),
  ]
    .filter(Boolean)
    .join('\n');

  return `// ID: ${goal.id}
// Name: ${goal.name}
// Type: ${goal.properties.edge.executionDetail?.type || 'basic'}
// Relation to children: ${goal.relationToChildren}
// Children: ${Node.children(goal)
    .map((child) => child.id)
    .join(', ')}
module ${goal.id}
  ${variablesDefinition(goal)}

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}
endmodule

${formulaStatements}
`.trim();
};

import { getLogger } from '../../../../logger/logger';
import { achieveStatement } from './achieve';
import { achievedGoalFormula, maintainConditionFormula } from './formulas';

import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode } from '../../../../types';
import { pursueStatements } from './pursue';
import { skipStatement } from './skip';
import {
  type GoalModuleVariablesOptions,
  variablesDefinition,
} from './variables';

export const goalModule = (
  goal: EdgeGoalNode,
  variablesOptions?: GoalModuleVariablesOptions,
): string => {
  const logger = getLogger();
  logger.initGoal(goal);

  const formulaStatements = [
    maintainConditionFormula(goal),
    achievedGoalFormula(goal),
  ]
    .filter(Boolean)
    .join('\n');

  return `// ID: ${goal.id}
// Name: ${goal.name}
// Type: ${goal.properties.engine.executionDetail?.type || 'basic'}
// Relation to children: ${goal.relationToChildren}
// Children: ${Node.children(goal)
    .map((child) => child.id)
    .join(', ')}
module ${goal.id}
  ${variablesDefinition(goal, variablesOptions)}

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}
endmodule

${formulaStatements}
`.trim();
};

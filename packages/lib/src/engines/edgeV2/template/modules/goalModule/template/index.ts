import { getLogger } from '../../../../logger/logger';
import { achieveStatement } from './achieve';
import {
  achievableGoalFormula,
  achievedGoalFormula,
  maintainConditionFormula,
  relativeFormulas,
} from './formulas';

import { construct, orderedChildIds } from './children';
import type { EdgeGoalNode } from '../../../../types';
import { pursueStatements } from './pursue';
import { skipStatement } from './skip';
import { variablesDefinition } from './variables';

export const goalModule = (goal: EdgeGoalNode): string => {
  const logger = getLogger();
  logger.initGoal(goal);

  const formulaStatements = [
    maintainConditionFormula(goal),
    achievedGoalFormula(goal),
    achievableGoalFormula(goal),
    relativeFormulas(goal),
  ]
    .filter(Boolean)
    .join('\n');

  return `// ID: ${goal.id}
// Name: ${goal.name}
// Type: ${construct(goal)}${goal.properties.engine.executionDetail ? '' : ' (no notation)'}
// Relation to children: ${goal.relationToChildren}
// Children: ${orderedChildIds(goal).join(', ')}
module ${goal.id}
  ${variablesDefinition(goal)}

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}
endmodule

${formulaStatements}
`.trim();
};

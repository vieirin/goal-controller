import { getLogger } from '../../../logger/logger';
import { achieved, failed, pursued, separator } from '../../../mdp/common';
import { GoalNodeWithParent, Relation } from '../../../ObjectiveTree/types';
import { childrenWithTasksAndResources } from '../../../ObjectiveTree/utils';
import {
  achievedVariable,
  chosenVariable,
  pursuedVariable,
} from '../../common';
import { maintainConditionFormula } from '../../formulas';
import { beenPursued } from './pursue/common';

import { pursueStatements } from './pursue/pursue';
import { skipStatement } from './skip/skip';

const isValidSeparator = (
  relation: Relation | null
): relation is 'and' | 'or' => {
  return ['and', 'or'].includes(relation ?? '');
};

const achieveCondition = (goal: GoalNodeWithParent) => {
  if (isValidSeparator(goal.relationToChildren)) {
    const children = [...(goal.children || []), ...(goal.tasks || [])];
    if (children.length) {
      return `(${children
        .map((child) => `${achievedVariable(child.id)}=1`)
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

const achieveStatement = (goal: GoalNodeWithParent) => {
  const logger = getLogger();

  const leftStatement = [
    beenPursued(goal.id, { condition: true }),
    achieveCondition(goal),
  ]
    .filter(Boolean)
    .join(separator('and'));

  const updateStatement = `(${pursued(goal.id)}'=0) & (${achieved(
    goal.id
  )}'=1);`;

  const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;

  logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
  return prismLabelStatement;
};

export const goalModule = (goal: GoalNodeWithParent) => {
  const logger = getLogger();
  logger.initGoal(goal);

  const defineVariable = (variable: string, upperBound: number) => {
    logger.variableDefinition(variable, upperBound);
    return `${variable} : [0..${upperBound}] init 0;`;
  };

  return `module ${goal.id}

  ${defineVariable(pursuedVariable(goal.id), 1)}
  ${defineVariable(achievedVariable(goal.id), 1)}
  ${
    goal.executionDetail?.type === 'choice'
      ? `${defineVariable(
          chosenVariable(goal.id),
          childrenWithTasksAndResources({ node: goal }).length
        )}`
      : ''
  }
  ${
    goal.customProperties.maxRetries
      ? `${failed(goal.id)} : [0..${goal.customProperties.maxRetries}] init 0;`
      : ''
  }

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}

endmodule

${maintainConditionFormula(goal)}
`.trim();
};

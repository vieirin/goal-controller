import { GoalNodeWithParent, Relation } from '../../../GoalTree/types';
import { getLogger } from '../../../logger/logger';
import { achieved, failed, pursued, separator } from '../../../mdp/common';
import {
  achievedVariable,
  chosenVariable,
  pursuedVariable,
} from '../../common';
import { achievedMaintain, maintainConditionFormula } from '../../formulas';
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
        .map((child) =>
          child.execCondition?.maintain
            ? `${achievedMaintain(child.id)}=true`
            : `${achievedVariable(child.id)}=1`
        )
        .join(separator(goal.relationToChildren))})`;
    }
  }
  return '';
};

const achieveStatement = (goal: GoalNodeWithParent) => {
  const logger = getLogger();

  const leftStatement = [
    beenPursued(goal, { condition: true }),
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

const variablesDefinition = (goal: GoalNodeWithParent) => {
  const logger = getLogger();
  const defineVariable = (variable: string, upperBound: number) => {
    logger.variableDefinition({
      variable,
      upperBound,
      initialValue: 0,
      type: 'int',
    });
    return `${variable} : [0..${upperBound}] init 0;`;
  };

  const pursuedVariableStatement = defineVariable(pursuedVariable(goal.id), 1);
  const achievedVariableStatement = !goal.execCondition?.maintain
    ? defineVariable(achievedVariable(goal.id), 1)
    : null;

  const chosenVariableStatement =
    goal.executionDetail?.type === 'choice'
      ? defineVariable(chosenVariable(goal.id), 1)
      : null;
  const maxRetriesVariableStatement = goal.customProperties.maxRetries
    ? defineVariable(failed(goal.id), goal.customProperties.maxRetries)
    : null;

  return [
    pursuedVariableStatement,
    achievedVariableStatement,
    chosenVariableStatement,
    maxRetriesVariableStatement,
  ]
    .filter(Boolean)
    .join('\n  ');
};

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
`.trim();
};

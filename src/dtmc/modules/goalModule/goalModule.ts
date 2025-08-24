import { achieved, failed, pursued, separator } from '../../../mdp/common';
import { GoalNodeWithParent, Relation } from '../../../ObjectiveTree/types';
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
  const leftStatement = [
    beenPursued(goal.id, { condition: true }),
    ...[achieveCondition(goal)],
  ]
    .filter(Boolean)
    .join(separator('and'));

  return `[achieved_${goal.id}] ${leftStatement} -> (${pursued(
    goal.id
  )}'=0) & (${achieved(goal.id)}'=1);`;
};

export const goalModule = (goal: GoalNodeWithParent) => {
  return `module ${goal.id}

  ${pursuedVariable(goal.id)} : [0..1] init 0;
  ${achievedVariable(goal.id)} : [0..1] init 0;
  ${
    goal.executionDetail?.type === 'alternative'
      ? `${chosenVariable(goal.id)} : [0..${
          goal.executionDetail.alternative.length
        }] init 0;`
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

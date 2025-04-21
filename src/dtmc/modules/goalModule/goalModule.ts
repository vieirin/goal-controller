import { achieved, failed, pursued, separator } from '../../../mdp/common';
import { GoalNodeWithParent, Relation } from '../../../ObjectiveTree/types';
import { maintainConditionFormula } from '../../formulas';
import { beenPursued } from '../pursue/common';
import { pursueStatements } from '../pursue/pursue';

const skipStatement = (goal: GoalNodeWithParent) => {
  return `[skip_${goal.id}] ${pursued(goal.id)}=1 -> (${pursued(goal.id)}'=0);`;
};

const isValidSeparator = (
  relation: Relation | null
): relation is 'and' | 'or' => {
  return ['and', 'or'].includes(relation ?? '');
};

const achieveCondition = (goal: GoalNodeWithParent) => {
  if (goal.children && isValidSeparator(goal?.relationToChildren)) {
    return `(${goal.children.map((child) => pursued(child.id)).join(separator(goal.relationToChildren))})`;
  }
  return '';
};

const achieveStatement = (goal: GoalNodeWithParent) => {
  const leftStatement = [
    beenPursued(goal.id, { condition: true }),
    ...(goal.children?.length ? [achieveCondition(goal)] : []),
  ]
    .filter(Boolean)
    .join(separator('and'));

  return `[achieved_${goal.id}] ${leftStatement} -> (${pursued(goal.id)}'=0) & (${achieved(goal.id)}'=1);`;
};

export const goalModule = (goal: GoalNodeWithParent) => {
  return `module ${goal.id}

  ${pursued(goal.id)} : [0..1] init 0;
  ${achieved(goal.id)} : [0..1] init 0;
  ${
    goal.customProperties.maxRetries
      ? `${failed(goal.id)} : [0..${goal.customProperties.maxRetries}] init 0;`
      : ''
  }

  ${pursueStatements(goal).join('\n  ')}

  ${achieveStatement(goal)}
  
  ${skipStatement(goal)}

end module

${maintainConditionFormula(goal)}
`.trim();
};

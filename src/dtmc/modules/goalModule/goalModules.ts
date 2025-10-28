import {
  GoalNodeWithParent,
  GoalTreeWithParent,
} from '../../../GoalTree/types';
import { allByType, childrenLength } from '../../../GoalTree/utils';
import { pursued, separator } from '../../../mdp/common';
import { goalModule } from './goalModule';

const declareManagerVariables = ({
  goals,
}: {
  goals: GoalNodeWithParent[];
}) => {
  return [
    ...goals.map(
      (goal) =>
        `  ${pursued(goal.id)} : [0..${childrenLength({ node: goal })}] init 0;`
    ),
  ].join('\n');
};

// we're gonna have an entry for each decision combination
// for instance, if we have decision variables for time, we'll have
// an entry for each time value
// we need to map each variable in the combination to the corresponding decision variable
// for instance, decision_G0_0_1 should be mapped to `t=0 & s=1`
const variableStatement = (
  variableArray: string[],
  variableCombination: number[]
) => {
  return variableArray
    .map((decisionVarName, i) => `${decisionVarName}=${variableCombination[i]}`)
    .join(separator('and'));
};

export const goalNumberId = (goalId: string) => {
  const id = goalId.match(/\d+/)?.[0];
  if (!id) {
    throw new Error(
      `The goal id must follow the pattern 'G%d', got: '${goalId}'`
    );
  }
  return id;
};

export const goalModules = ({ gm }: { gm: GoalTreeWithParent }) => {
  const goals = allByType({ gm, type: 'goal' });
  return `
${goals
  .sort(
    (a, b) => Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0])
  )
  .map(goalModule)
  .join('\n\n')}
`;
};

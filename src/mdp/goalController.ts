import { GoalTree } from '../ObjectiveTree/types';
import { leavesGrouppedGoals } from './common';

const controllerVariables = ({ gm }: { gm: GoalTree }) =>
  Object.entries(leavesGrouppedGoals({ gm })).map(([goalGroup, variants]) => {
    if (variants.every((v) => !!v.variantOf)) {
      return { variable: goalGroup, variants: variants.length };
    }
    if (variants.length == 1) {
      return { variable: goalGroup };
    }
    throw new Error(
      'Expected either single (leaf) goal in the group or all elements to be variants'
    );
  });

export const goalControllerVariables = ({ gm }: { gm: GoalTree }) => {
  const variables = controllerVariables({ gm });
  console.log(variables);
  return variables
    .map(
      (v) =>
        `${v.variable}_pursued : [0..${v.variants ?? 1}] init 0; // goal ${
          v.variable
        } is: 0 - not pursued, ${
          v.variants
            ? `${[...Array(v.variants).keys()]
                .map((i) => {
                  `${i + 1} - pursued as variant ${i + 1}`;
                })
                .join(',')}`
            : '1 - pursued'
        }`
    )
    .join('\n');
};

export const goalVariablesLength = ({ gm }: { gm: GoalTree }) =>
  controllerVariables({ gm }).length;

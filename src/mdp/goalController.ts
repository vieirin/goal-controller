import { ConditionDependency } from '../ObjectiveTree/dependencyResolver';
import { GoalTree } from '../ObjectiveTree/types';
import {
  achievable,
  achieved,
  leavesGrouppedGoals,
  not,
  parenthesis,
  separator,
} from './common';
import { conditionalTree } from './conditionalTree';
import { dependency } from './controler/dependency';
import { variantsPursue } from './controler/pursue';
import { variantsSkip } from './controler/skip';

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

export const goalTransitions = ({ gm }: { gm: GoalTree }) => {
  const goalConditions = conditionalTree({ gm });
  const conds = goalConditions.map((conditions) => {
    const isVariant = conditions.length > 1;
    if (!isVariant) {
      const condition = conditions[0];
      return {
        skip: parenthesis(
          [
            achieved(condition.goal),
            not(achievable(condition.goal)),
            not(dependency({ condition, negateItems: false, sep: 'or' })),
          ]
            .filter(Boolean)
            .join(separator('or'))
        ),
        pursueDefault: [
          not(achieved(condition.goal)),
          achievable(condition.goal),
          dependency({ condition, negateItems: false, sep: 'or' }),
        ]
          .filter(Boolean)
          .join(separator('and')),
      };
    }

    return {
      skip: variantsSkip({ conditions }),
      pursueDefault: variantsPursue({ conditions }),
    };
  });
  console.log(conds);
};

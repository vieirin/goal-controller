import { ConditionDependency } from '../ObjectiveTree/dependencyResolver';
import { GoalNode, GoalTree } from '../ObjectiveTree/types';
import { allGoalsMap, goalRootId, isVariant } from '../ObjectiveTree/utils';
import { leavesGrouppedGoals, negate, separator } from './common';
import { conditionalTree } from './conditionalTree';

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

const dependency = (condition: ConditionDependency) => {
  const { depends } = condition;
  console.log(condition);
  if (!depends) {
    return '';
  }
  if (!condition.isVariant) {
    if (!depends.isFormula) {
      return `(${depends.goal}_achieved | ${depends.goal}_pursued>0)`;
    }

    return `${goalRootId({ id: depends.goal })}_achieved_or_pursued`;
  }
  return '';
};

const skipAchieved = (goalIds: string[]) =>
  goalIds.map((id) => `${id}_achieved`).join(separator('or'));
const skipAchievable = (goalIds: string[]) =>
  goalIds.map((id) => `${id}_achievable`);

export const goalTransitions = ({ gm }: { gm: GoalTree }) => {
  const goalConditions = conditionalTree({ gm });
  const conds = goalConditions.map((conditions) => {
    const isVariant = conditions.length > 1;
    if (!isVariant) {
      const condition = conditions[0];
      return {
        skip: `(${[
          `${condition.goal}_achieved`,
          `!${condition.goal}_achievable`,
          negate(dependency(condition)),
        ]
          .filter(Boolean)
          .join(separator('or'))})`,
      };
    }
    const goalIds = conditions.map(({ goal }) => goal);
    return {
      skip: `(${skipAchieved(goalIds)})`,
    };
  });
  console.log(conds);
};

import { ConditionDependency } from '../ObjectiveTree/dependencyResolver';
import { GoalTree } from '../ObjectiveTree/types';
import { goalRootId } from '../ObjectiveTree/utils';
import {
  achievable,
  achieved,
  equals,
  GrouppedGoals,
  not,
  parenthesis,
  pursue,
  pursued,
  pursueDefault,
  separator,
  skip,
} from './common';
import { conditionalTree } from './conditionalTree';
import { dependency } from './controler/dependency';
import { variantsPursue, variantsPursueDefault } from './controler/pursue';
import { variantsSkip } from './controler/skip';

const controllerVariables = ({
  grouppedGoals,
}: {
  grouppedGoals: GrouppedGoals;
}) =>
  Object.entries(grouppedGoals).map(([goalGroup, variants]) => {
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

export const goalControllerVariables = ({
  grouppedGoals,
}: {
  grouppedGoals: GrouppedGoals;
}) =>
  controllerVariables({ grouppedGoals })
    .map(
      (v) =>
        `${v.variable}_pursued : [0..${v.variants ?? 1}] init 0; // goal ${
          v.variable
        } is: 0 - not pursued, ${
          v.variants
            ? `${[...Array.from(Array(v.variants).keys())]
                .map((i) => `${i + 1} - pursued as variant ${i + 1}`)
                .join(',')}`
            : '1 - pursued'
        }`
    )
    .map((v) => `  ${v}`)
    .join('\n');

const goalConditions = ({
  conditions,
}: {
  conditions: ConditionDependency[][];
}) =>
  conditions.map((goalConditions) => {
    const isVariant = goalConditions.length > 1;
    if (!isVariant) {
      const condition = goalConditions[0];
      const goal = condition.goal;
      return {
        rootGoal: goalRootId({ id: goal }),
        sentences: {
          skip: parenthesis(
            [
              achieved(goal),
              not(achievable(goal)),
              not(dependency({ condition, negateItems: false, sep: 'or' })),
            ]
              .filter(Boolean)
              .join(separator('or'))
          ),
          pursueDefault: [
            not(achieved(goal)),
            achievable(goal),
            dependency({ condition, negateItems: false, sep: 'or' }),
          ]
            .filter(Boolean)
            .join(separator('and')),
          pursueVariants: [
            {
              variant: goal,
              sentence: [
                not(achieved(goal)),
                achievable(goal),
                dependency({ condition, negateItems: false, sep: 'or' }),
              ]
                .filter(Boolean)
                .join(separator('and')),
            },
          ],
        },
      };
    }

    return {
      hasVariant: true,
      rootGoal: goalRootId({ id: goalConditions[0].goal }),
      sentences: {
        skip: variantsSkip({ conditions: goalConditions }),
        pursueDefault: variantsPursueDefault({ conditions: goalConditions }),
        pursueVariants: variantsPursue({ conditions: goalConditions }),
      },
    } as const;
  });

const startCondition = ({ n }: { n: number }) => `t & (n=${n})`;
const condition = ({ n, sentence }: { n: number; sentence: string }) =>
  `${startCondition({ n })} & ${sentence}`;

const update = ({
  rootGoal,
  update: { n, goalValue },
}: {
  rootGoal: string;
  update: { n: number; goalValue: number };
}) =>
  `1:${[
    parenthesis(equals(`${pursued(rootGoal)}'`, goalValue)),
    parenthesis(equals(`n'`, n + 1)),
  ].join(separator('and').trim())}`;

const goalSentence = ({
  state,
  rootGoal,
  n,
  sentence,
  goalValue = 0,
}: {
  state: string;
  rootGoal: string;
  sentence: string;
  n: number;
  goalValue?: number;
}) =>
  `[${state}] ${condition({
    n,
    sentence,
  })} -> ${update({ rootGoal, update: { n, goalValue } })};`;

export const goalTransitions = ({
  grouppedGoals,
  gm,
}: {
  grouppedGoals: GrouppedGoals;
  gm: GoalTree;
}) => {
  const conditions = conditionalTree({ grouppedGoals, gm });
  const conditionSentences = goalConditions({ conditions });

  const sentences = conditionSentences.map(({ rootGoal, sentences }, n) => {
    return `  // block of commands for the selecting the way in which goal g2 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  ${goalSentence({
    state: skip(rootGoal),
    rootGoal,
    sentence: sentences.skip,
    n,
  })}
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  ${goalSentence({
    state: pursueDefault(rootGoal),
    rootGoal,
    sentence: sentences.pursueDefault,
    n,
  })}
${sentences.pursueVariants
  .map(({ sentence, variant }, i) => {
    return goalSentence({
      state: pursue(variant),
      rootGoal,
      n,
      sentence,
      goalValue: i + 1,
    });
  })
  .map((s) => `  ${s}`)
  .join('\n')}
  `;
  });
  return sentences.join('\n\n');
};

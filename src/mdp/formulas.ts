import { GoalNode, GoalTree } from '../ObjectiveTree/types';
import { allGoalsMap, goalRootId } from '../ObjectiveTree/utils';
import {
  achieved,
  achievedOrPursued,
  greaterThan,
  pursued,
  separator,
} from './common';

type NodeOrChildProps = {
  node: GoalNode | undefined;
  appendAchieve?: boolean;
};
const alternativeChildrenFormula = ({
  node,
  appendAchieve = true,
}: NodeOrChildProps) => {
  return (
    node?.children
      ?.filter((child) => child.customProperties.alt)
      .map((child) => {
        if (child.children?.length) {
          const ids = child.children
            .map((granChildren) => granChildren.id)
            .map((id) => `${appendAchieve ? achieved(id) : ''}`);

          return {
            ids,
            relation: child.relationToChildren,
            rootId: goalRootId({ id: ids?.[0] }),
          };
        }
        throw new Error(`Missing children for goal: ${child.id} `);
      }) ?? []
  );
};

const nonAlternativeChildrenFormula = ({
  node,
  appendAchieve = true,
}: NodeOrChildProps) => {
  return {
    ids:
      node?.children
        ?.filter((child) => !child.customProperties.alt)
        .map((child) => child.id)
        .map((id) => `${appendAchieve ? achieved(id) : id}`) ?? [],
    relation: node?.relationToChildren ?? null,
  };
};

type TreeOrChildrenProps = { gm: GoalTree };
const goalsWithFormula = ({ gm }: TreeOrChildrenProps): GoalNode[] => {
  return (
    gm?.map((node) => {
      const shouldHaveFormula =
        (!!node.children?.length && !node.customProperties.alt) ||
        node.children?.some((child) => child.customProperties.alt);

      const childrenWithFormula = node.children
        ? goalsWithFormula({ gm: node.children })
        : [];
      return [
        ...(shouldHaveFormula ? [node] : []),
        ...(childrenWithFormula ?? []),
      ];
    }) ?? []
  ).flat();
};

const treeFormula = ({
  goalsToFormulate,
  appendAchieve,
}: {
  goalsToFormulate: GoalNode[];
  appendAchieve?: boolean;
}) => {
  return goalsToFormulate.map((goal) => {
    const alternativeExpandedChildren = alternativeChildrenFormula({
      node: goal,
    });
    const nonAlternativeExpandedChildren = nonAlternativeChildrenFormula({
      node: goal,
      appendAchieve,
    });
    return {
      formulatedGoal: goal.id,
      rootLevel: nonAlternativeExpandedChildren,
      underLevel: alternativeExpandedChildren,
    };
  });
};

type TemplateProps = { gm: GoalTree };
const goalDependency = ({
  gm,
}: TreeOrChildrenProps): { id: string; dependant: string }[] => {
  return (
    gm?.map((node) => {
      const dependency = node.customProperties.dependsOn;
      const childrenWithFormula = node.children
        ? goalDependency({ gm: node.children })
        : [];
      if (!dependency.length) {
        return [...(childrenWithFormula ?? [])];
      }

      return [
        ...dependency.map((dep) => ({ id: dep, dependant: node.id })),
        ...(childrenWithFormula ?? []),
      ];
    }) ?? []
  ).flat();
};

const goalsWithDependency = ({ gm }: TreeOrChildrenProps): GoalNode[] => {
  const dependency = goalDependency({ gm });
  const allGoals = allGoalsMap({ gm });
  const matchedGoals = dependency
    .map((dep) => allGoals.get(dep.id))
    .filter((v): v is GoalNode => Boolean(v));

  if (matchedGoals.length != dependency.length) {
    throw new Error(
      `Missing goals on the model, requested dependencies were ${dependency
        .map((d) => `(${d.dependant}: depends on ${d.id})`)
        .join(
          ';'
        )}\nCheck the depends on strings, they should match existing elements in the goal model`
    );
  }

  return matchedGoals.filter((goal) => goal.children?.length);
};

const goalTreeFormula = ({ gm }: TemplateProps) => {
  const goalsToFormulate = goalsWithFormula({ gm });
  return treeFormula({ goalsToFormulate });
};

export const goalFormulaes = ({ gm }: TemplateProps) => {
  const treeFormula = goalTreeFormula({ gm });
  return treeFormula.map(({ underLevel, rootLevel, formulatedGoal }) => {
    return `formula ${achieved(formulatedGoal)} = ${[
      ...underLevel.map(
        (elem) => `(${elem.ids.join(separator(elem.relation))})`
      ),
      ...rootLevel.ids,
    ].join(separator(rootLevel.relation))};`;
  });
};

const goalDependencyFormula = ({ gm }: TemplateProps) => {
  const goalsToFormulate = goalsWithDependency({ gm });
  return treeFormula({ goalsToFormulate, appendAchieve: false });
};

export const dependencyFormulaes = ({ gm }: TemplateProps) => {
  const dependencyFormula = goalDependencyFormula({ gm });
  const dependency = dependencyFormula.map(
    ({ underLevel, rootLevel, formulatedGoal }) => {
      return `formula ${achievedOrPursued(
        goalRootId({
          id: formulatedGoal,
        })
      )} = 
              ${[
                ...rootLevel.ids.map(
                  (id) =>
                    `(${[
                      `${achieved(id)}`,
                      `${greaterThan(pursued(id), 0)}`,
                    ].join(separator('or'))})`
                ),
                ...underLevel.map(
                  ({ rootId, ids }) =>
                    `(${[
                      ids.map((id) => `${id}`).join(separator('or')),
                      `${pursued(rootId)} > 0`,
                    ].join(separator('or'))})`
                ),
              ].join(`${separator(rootLevel.relation)}\n${' '.repeat(14)}`)};`;
    }
  );

  return dependency;
};

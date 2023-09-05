import { GoalNode, GoalTree, Relation } from '../ObjectiveTree/types';
import { allGoals, goalRootId } from '../ObjectiveTree/utils';

type NodeOrChildProps = { node: GoalNode | undefined; appendAchieve?: boolean };
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
            .map((id) => `${id}${appendAchieve ? '_achieved' : ''}`);

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
        .map((id) => `${id}${appendAchieve ? '_achieved' : ''}`) ?? [],
    relation: node?.relationToChildren ?? null,
  };
};

type TreeOrChildrenProps = { gm: GoalTree | undefined };
const goalsWithFormula = ({ gm }: TreeOrChildrenProps): GoalNode[] => {
  return (
    gm?.map((node) => {
      const shouldHaveFormula =
        (!!node.children?.length && !node.customProperties.alt) ||
        node.children?.some((child) => child.customProperties.alt);

      const childreWithFormula = goalsWithFormula({ gm: node.children });
      return [
        ...(shouldHaveFormula ? [node] : []),
        ...(childreWithFormula ?? []),
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
      const childrenWithFormula = goalDependency({ gm: node.children });
      if (!dependency) {
        return [...(childrenWithFormula ?? [])];
      }

      return [
        ...[{ id: dependency, dependant: node.id }],
        ...(childrenWithFormula ?? []),
      ];
    }) ?? []
  ).flat();
};
const goalsWithDependency = ({ gm }: TreeOrChildrenProps): GoalNode[] => {
  const dependency = goalDependency({ gm });

  const matchedGoals = allGoals({ gm }).filter(({ id }) =>
    dependency.map(({ id }) => id).includes(id)
  );

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

const separator = (relation: Relation | null) => {
  switch (relation) {
    case 'or':
      return ' | ';
    case 'and':
      return ' & ';
    default:
      throw new Error(`Relation "${relation}" not allowed`);
  }
};

export const goalFormulaes = ({ gm }: TemplateProps) => {
  const treeFormula = goalTreeFormula({ gm });
  return treeFormula.map(({ underLevel, rootLevel, formulatedGoal }) => {
    return `formula ${formulatedGoal}_achieved = ${[
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
      return `formula ${goalRootId({
        id: formulatedGoal,
      })}_achieved_or_pursued = 
              ${[
                ...rootLevel.ids.map(
                  (id) =>
                    `(${[`${id}_achieved`, `${id}_pursued>0`].join(
                      separator('or')
                    )})`
                ),
                ...underLevel.map(
                  ({ rootId, ids }) =>
                    `(${[
                      ids.map((id) => `${id}`).join(separator('or')),
                      `${rootId}_pursued > 0`,
                    ].join(separator('or'))});`
                ),
              ].join(`${separator(rootLevel.relation)}\n${' '.repeat(14)}`)}`;
    }
  );

  return dependency;
};

import { GoalNode, GoalTree, Relation } from '../ObjectiveTree/types';

const alternativeChildrenFormula = ({
  node,
}: {
  node: GoalNode | undefined;
}) => {
  return (
    node?.children
      ?.filter((child) => child.customProperties.alt)
      .map((child) => {
        if (child.children?.length) {
          return {
            ids: child.children
              .map((granChildren) => granChildren.id)
              .map((id) => `${id}_achieved`),
            relation: child.relationToChildren,
          };
        }
        throw new Error(`Missing children for goal: ${child.id} `);
      }) ?? []
  );
};

const nonAlternativeChildrenFormula = ({
  node,
}: {
  node: GoalNode | undefined;
}) => {
  return {
    ids:
      node?.children
        ?.filter((child) => !child.customProperties.alt)
        .map((child) => child.id)
        .map((id) => `${id}_achieved`) ?? [],
    relation: node?.relationToChildren ?? null,
  };
};

const goalsWithFormula = ({ gm }: { gm: GoalTree | undefined }): GoalNode[] => {
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

export const goalTreeFormula = ({ gm }: { gm: GoalTree | undefined }) => {
  const goalsToFormulate = goalsWithFormula({ gm });
  return goalsToFormulate.map((goal) => {
    const alternativeExpandedChildren = alternativeChildrenFormula({
      node: goal,
    });
    const nonAlternativeExpandedChildren = nonAlternativeChildrenFormula({
      node: goal,
    });
    return {
      formulatedGoal: goal.id,
      rootLevel: nonAlternativeExpandedChildren,
      underLevel: alternativeExpandedChildren,
    };
  });
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

export const goalFormulaes = ({ gm }: { gm: GoalTree | undefined }) => {
  const treeFormula = goalTreeFormula({ gm });
  return treeFormula.map(({ underLevel, rootLevel, formulatedGoal }) => {
    return `formula ${formulatedGoal}_achieved = ${[
      ...underLevel.map(
        (elem) => `(${elem.ids.join(separator(elem.relation))})`
      ),
      ...rootLevel.ids,
    ].join(separator(rootLevel.relation))}`;
  });
};

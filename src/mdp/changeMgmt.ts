import { groupBy } from 'lodash';
import { GoalTree } from '../ObjectiveTree/types';
import { leafGoals } from '../ObjectiveTree/utils';

export const goalVariables = ({ gm }: { gm: GoalTree }) => {
  const leaves = leafGoals({ gm });
  const goalGroups = groupBy(leaves, ({ id }) => id.slice(0, 2));
  const variableLines = Object.entries(goalGroups).map(([goal, variants]) => {
    return variants
      .map((variant) => [
        `${variant.id}_achievable: bool init true;`,
        `${variant.id}_achieved: bool init false;`,
      ])
      .map((elem) => elem.map((line) => `  ${line}`));
  });
  console.log(variableLines);

  const grouppedVariableLines = variableLines.map((line) =>
    groupBy(line.flat(), (l) => l.includes('achievable'))
  );
  console.log(grouppedVariableLines);

  return grouppedVariableLines
    .map((grouppedLine) =>
      Object.values(grouppedLine)
        .map((elem) => elem)
        .flat()
    )
    .map((line) => line.join('\n'))
    .join('\n\n');
};

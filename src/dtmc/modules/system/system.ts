import { readFileSync } from 'fs';
import { treeVariables } from '../../../ObjectiveTree/treeVariables';
import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';
import { getVariablesFilePath } from '../../../cli/menu/variablesInput';

export const systemModule = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  const variables = treeVariables(gm);

  return `module System
  ${(() => {
    if (variables.length === 0) {
      return '';
    }

    try {
      const variablesFilePath = getVariablesFilePath(fileName);
      const defaultVariableValues = JSON.parse(
        readFileSync(variablesFilePath, 'utf8')
      );
      return variables
        .map((variable) => {
          return `${variable}: bool init ${
            defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION'
          }`;
        })
        .join('\n  ')
        .trim();
    } catch (error) {
      console.error('Error reading variables file:', error);
      throw new Error('Error reading variables file');
    }
  })()}
endmodule`;
};

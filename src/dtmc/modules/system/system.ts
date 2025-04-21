import { readFileSync } from 'fs';
import path, { join } from 'path';
import { treeVariables } from '../../../ObjectiveTree/treeVariables';
import type { GoalTreeWithParent } from '../../../ObjectiveTree/types';

export const systemModule = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  const variables = treeVariables(gm);

  try {
    const defaultVariableValues = JSON.parse(
      readFileSync(
        join('input', path.parse(fileName).name, 'variables.json'),
        'utf8'
      )
    );
    return `module System
  ${variables
    .map((variable) => {
      return `${variable}: bool init ${defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION'}`;
    })
    .join('\n  ')
    .trim()}
endmodule`;
  } catch (error) {
    console.error('Error reading variables file:', error);
    throw new Error('Error reading variables file');
  }
};

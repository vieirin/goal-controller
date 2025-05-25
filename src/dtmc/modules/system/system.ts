import { readFileSync } from 'fs';
import { getVariablesFilePath } from '../../../cli/menu/variablesInput';
import { isResource } from '../../../ObjectiveTree/nodeUtils';
import { treeContextVariables } from '../../../ObjectiveTree/treeVariables';
import type {
  GoalTreeWithParent,
  Resource,
} from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';

const resourceVariableName = (resource: Resource) => `resource_${resource.id}`;

export const systemModule = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  const variables = treeContextVariables(gm);
  const resources = allByType({ gm, type: 'resource' });
  if (!isResource(resources)) {
    throw new Error('Resources must be an array of resources');
  }
  const resourceVariables = resources.map((resource: Resource) => {
    const { variable } = resource;
    if (variable.type === 'boolean') {
      return `${resourceVariableName(resource)}: bool init ${
        variable.initialValue
      };`;
    } else if (variable.type === 'int') {
      return `${resourceVariableName(resource)}: int [${variable.lowerBound}..${
        variable.upperBound
      }] init ${variable.initialValue};`;
    }
  });

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

      return [
        variables.map((variable) => {
          return `${variable}: bool init ${
            defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION'
          }`;
        }),
        resourceVariables.join('\n  '),
      ]
        .flat()
        .join('\n  ')
        .trim();
    } catch (error) {
      console.error('Error reading variables file:', error);
      throw new Error('Error reading variables file');
    }
  })()}
endmodule`;
};

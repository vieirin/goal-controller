import { readFileSync } from 'fs';
import { getVariablesFilePath } from '../../../cli/menu/variablesInput';
import { getLogger } from '../../../logger/logger';
import { isResource } from '../../../ObjectiveTree/nodeUtils';
import { treeContextVariables } from '../../../ObjectiveTree/treeVariables';
import type {
  GoalTreeWithParent,
  Resource,
} from '../../../ObjectiveTree/types';
import { allByType } from '../../../ObjectiveTree/utils';

const resourceVariableName = (resource: Resource) => `${resource.id}`;

const defineVariable = (
  variable: string,
  initialValue: number | boolean,
  type: 'boolean' | 'int',
  lowerBound?: number | boolean,
  upperBound?: number | boolean
) => {
  const logger = getLogger();
  logger.variableDefinition({
    variable,
    initialValue,
    type,
    lowerBound,
    upperBound,
  });
  switch (type) {
    case 'boolean':
      return `${variable}: bool init ${initialValue};`;
    case 'int':
      return `${variable}: [${lowerBound}..${upperBound}] init ${initialValue};`;
  }
};

export const systemModule = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  const logger = getLogger();
  logger.initSystem();
  const variables = treeContextVariables(gm);
  // resources are deduped in allByType
  const resources = allByType({ gm, type: 'resource' });
  if (!isResource(resources)) {
    throw new Error('Resources must be an array of resources');
  }
  const resourceVariables = resources.map((resource: Resource) => {
    const { variable } = resource;
    if (variable.type === 'boolean') {
      return defineVariable(
        resourceVariableName(resource),
        variable.initialValue,
        'boolean'
      );
    } else if (variable.type === 'int') {
      return defineVariable(
        resourceVariableName(resource),
        variable.initialValue,
        'int',
        variable.lowerBound,
        variable.upperBound
      );
    }
  });

  return `module System
  ${(() => {
    try {
      const variablesFilePath = getVariablesFilePath(fileName);
      const defaultVariableValues =
        variables.length > 0
          ? JSON.parse(readFileSync(variablesFilePath, 'utf8'))
          : {};

      return [
        variables.map((variable) => {
          return defineVariable(
            variable,
            defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION',
            'boolean'
          );
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

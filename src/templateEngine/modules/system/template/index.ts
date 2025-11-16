import type { Resource } from '../../../../GoalTree/types';
import { defineVariable, resourceVariableName } from './variable';

export const systemModuleTemplate = ({
  variables,
  resources,
  defaultVariableValues,
}: {
  variables: string[];
  resources: Resource[];
  defaultVariableValues: Record<string, number | boolean>;
}) => {
  const resourceVariables = resources.map((resource) => {
    if (resource.variable.type === 'boolean') {
      return defineVariable(
        resourceVariableName(resource),
        resource.variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION',
        resource.variable.type,
        'resource',
      );
    }

    return defineVariable(
      resourceVariableName(resource),
      resource.variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION',
      resource.variable.type,
      'resource',
      resource.variable.lowerBound,
      resource.variable.upperBound,
    );
  });
  return `module System
  ${[
    variables.map((variable) => {
      return defineVariable(
        variable,
        defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION',
        'boolean',
        'context',
      );
    }),
    resourceVariables.join('\n  '),
  ]
    .flat()
    .join('\n  ')
    .trim()}
endmodule`;
};

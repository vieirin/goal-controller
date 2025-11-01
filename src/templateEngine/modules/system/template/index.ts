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
    return defineVariable(
      resourceVariableName(resource),
      defaultVariableValues[resource.id] ?? 'MISSING_VARIABLE_DEFINITION',
      resource.variable.type
    );
  });
  return `module System
    ${[
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
      .trim()}
  endmodule`;
};

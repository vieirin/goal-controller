import { defineVariable, resourceVariableName } from './variable';
import type { EdgeResource } from '../../../edgeTypes';

export const systemModuleTemplate = ({
  variables,
  resources,
  defaultVariableValues,
  oldTransitions,
}: {
  variables: string[];
  resources: Array<EdgeResource>;
  defaultVariableValues: Record<string, number | boolean>;
  oldTransitions?: string[];
}): string => {
  const resourceVariables = resources.map((resource) => {
    const { variable } = resource.properties.engine;
    if (variable.type === 'boolean') {
      return defineVariable(
        resourceVariableName(resource),
        variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION',
        variable.type,
        'resource',
      );
    }

    return defineVariable(
      resourceVariableName(resource),
      variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION',
      variable.type,
      'resource',
      variable.lowerBound,
      variable.upperBound,
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
    oldTransitions?.map((str) => str.trim()).join('\n  ') ?? '',
  ]
    .filter(Boolean)
    .flat()
    .join('\n  ')
    .trim()}
endmodule`;
};

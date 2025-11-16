import type { Resource } from '../../../../GoalTree/types';
import { getLogger } from '../../../../logger/logger';

export const resourceVariableName = (resource: Resource): string =>
  `${resource.id}`;

export const defineVariable = (
  variable: string,
  initialValue: number | boolean | 'MISSING_VARIABLE_DEFINITION',
  type: 'boolean' | 'int',
  context: 'resource' | 'context',
  lowerBound?: number | boolean,
  upperBound?: number | boolean,
): string => {
  const logger = getLogger();
  logger.variableDefinition({
    variable,
    initialValue,
    type,
    lowerBound,
    upperBound,
    context: 'system',
    subContext: context,
  });
  switch (type) {
    case 'boolean':
      return `${variable}: bool init ${initialValue};`;
    case 'int':
      return `${variable}: [${lowerBound}..${upperBound}] init ${initialValue};`;
  }
};

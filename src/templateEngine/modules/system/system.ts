import { readFileSync } from 'fs';
import { getVariablesFilePath } from '../../../cli/menu/variablesInput';
import { isResource } from '../../../GoalTree/nodeUtils';
import { treeContextVariables } from '../../../GoalTree/treeVariables';
import type { GoalTree } from '../../../GoalTree/types';
import { allByType } from '../../../GoalTree/utils';
import { getLogger } from '../../../logger/logger';
import { systemModuleTemplate } from './template';

export const systemModule = ({
  gm,
  fileName,
}: {
  gm: GoalTree;
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

  try {
    const variablesFilePath = getVariablesFilePath(fileName);
    const defaultVariableValues =
      variables.length > 0
        ? JSON.parse(readFileSync(variablesFilePath, 'utf8'))
        : {};
    return systemModuleTemplate({
      variables,
      resources,
      defaultVariableValues,
    });
  } catch (error) {
    console.error('Error reading variables file:', error);
    throw new Error('Error reading variables file');
  }
};

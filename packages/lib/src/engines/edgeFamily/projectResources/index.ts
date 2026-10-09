/** The Edge engines' project resources (edge and edgeV2 alike): variables and property suites. */
import { projectResourceParsers } from '../../projectResources';
import { edgeFamily } from '../definition';
import { parseProperties, type EdgePropertySuites } from './properties';
import { parseVariables, type EdgeVariables } from './variables';

export * from './properties';
export * from './variables';

export const edgeProjectResources = projectResourceParsers(edgeFamily)({
  variables: parseVariables,
  properties: parseProperties,
});

/** What the Edge engines read of their parsed resources (each may be missing). */
export type EdgeResourceData = {
  variables?: EdgeVariables;
  properties?: EdgePropertySuites;
};

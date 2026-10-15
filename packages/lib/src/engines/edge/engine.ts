import { defineEngine } from '../engine';
import { edgeCheckRegistry, edgeProjectResources } from '../edgeFamily';
import { edge } from './definition';
import { edgeEngineMapper } from './mapper';

/** Edge (v1), as the workbench registers it. */
export const edgeEngine = defineEngine({
  id: 'edge',
  help: 'Legacy Edge encoding',
  dialect: edge,
  checks: edgeCheckRegistry,
  mapper: edgeEngineMapper,
  output: { label: 'PRISM', extension: 'prism', language: 'prism' },
  outputs: [{ id: 'model', language: 'prism' }],
  options: true,
  projectResources: edgeProjectResources,
});

import { defineEngine } from '../engine';
import { edgeCheckRegistry, edgeProjectResources } from '../edgeFamily';
import { edgeV2 } from './definition';
import { edgeEngineMapper } from './mapper';
import { edgeV2Options } from './options';

/** EdgeV2, as the workbench registers it. */
export const edgeV2Engine = defineEngine({
  id: 'edgev2',
  help: 'EDGE reference encoding, with cost and utility rewards',
  dialect: edgeV2,
  checks: edgeCheckRegistry,
  mapper: edgeEngineMapper,
  output: { label: 'PRISM', extension: 'prism', language: 'prism' },
  outputs: [{ id: 'model', language: 'prism' }],
  options: edgeV2Options,
  projectResources: edgeProjectResources,
});

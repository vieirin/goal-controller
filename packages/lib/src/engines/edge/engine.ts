import { edgeVariables } from '../edgeFamily/variables';
import { optionOr, onTree } from '../run';
import { edgeOutput } from './template';
import { defineEngine } from '../engine';
import { edgeCheckRegistry, edgeProjectResources } from '../edgeFamily';
import { edge } from './definition';
import { edgeEngineMapper } from './mapper';
import { edgeOptions } from './options';

/** Edge (v1), as the workbench registers it. */
export const edgeEngine = defineEngine({
  id: 'edge',
  help: 'Legacy Edge encoding',
  dialect: edge,
  checks: edgeCheckRegistry,
  mapper: edgeEngineMapper,
  run: onTree(edgeEngineMapper, {
    generate: (gm, { modelName, options, variables, previousOutput }) =>
      edgeOutput({
        gm,
        fileName: modelName,
        clean: optionOr(options, 'clean', false),
        variables,
        generateDecisionVars: optionOr(options, 'generateDecisionVars', true),
        achievabilitySpace: optionOr(options, 'achievabilitySpace', 4),
        previousOutput,
        writeReport: false,
      }),
    variables: edgeVariables,
  }),
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/edgeFamily/properties.ts',
    lists: {
      goal: 'edgeProperties.goal',
      task: 'edgeProperties.task',
      resource: 'edgeProperties.resource',
      quality: 'edgeProperties.quality',
    },
    mapper: 'packages/lib/src/engines/edge/mapper.ts',
  },
  output: { label: 'PRISM', extension: 'prism', language: 'prism' },
  outputs: [{ id: 'model', language: 'prism' }],
  options: edgeOptions,
  projectResources: edgeProjectResources,
});

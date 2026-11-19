import { edgeVariables } from '../edgeFamily/variables';
import { optionOr, onTree } from '../run';
import { initLogger } from './logger/logger';
import { edgeV2Output } from './template';
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
  run: onTree(edgeEngineMapper, {
    generate: (gm, { modelName, options, variables, previousOutput }) =>
      edgeV2Output({
        gm,
        fileName: modelName,
        clean: optionOr(options, 'clean', false),
        variables,
        generateDecisionVars: optionOr(options, 'generateDecisionVars', true),
        achievabilitySpace: optionOr(options, 'achievabilitySpace', 4),
        taskLayout: optionOr(options, 'taskLayout', 'taskModules'),
        discretisation: optionOr(options, 'discretisation', 10),
        previousOutput,
        writeReport: false,
      }),
    variables: edgeVariables,
    // EdgeV2 logs to its own logger
    log: (modelName) => initLogger(modelName, false, true),
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
    mapper: 'packages/lib/src/engines/edgeV2/mapper.ts',
  },
  output: { label: 'PRISM', extension: 'prism', language: 'prism' },
  outputs: [{ id: 'model', language: 'prism' }],
  options: edgeV2Options,
  projectResources: edgeProjectResources,
});

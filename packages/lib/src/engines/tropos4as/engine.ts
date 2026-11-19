import { defineEngine } from '../engine';
import { tropos4asCheckRegistry } from './checks';
import { tropos4as } from './definition';
import { tropos4asAnalyses, tropos4asProjectResourceParsers } from './index';
import { tropos4asAnalysisModel, tropos4asEngineMapper } from './mapper';

/**
 * Tropos4AS, as the workbench registers it (goal-controller#136): an
 * analysis engine (each goal's lifecycle state per scenario step, drawn on
 * the model; no file), its models declaring its dialect's kinds.
 */
export const tropos4asEngine = defineEngine({
  id: 'tropos4as',
  help: 'Tropos4AS: runs the goal lifecycle of AAMAS 2009 over a scenario, each goal’s state per step drawn on the model',
  dialect: tropos4as,
  checks: tropos4asCheckRegistry,
  mapper: tropos4asEngineMapper,
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/tropos4as/definition.ts',
    lists: {
      goal: 'properties.goal',
      task: 'properties.task',
      quality: 'properties.quality',
    },
    mapper: 'packages/lib/src/engines/tropos4as/mapper.ts',
  },
  output: { label: 'Lifecycle', extension: 'txt', language: 'text' },
  analyses: tropos4asAnalyses,
  // a model of any framework, as the workbench parses it: the function at
  // string kinds (defineEngine infers no engine from a generic one beside
  // projectResources, goal-controller#185)
  analysisModel: tropos4asAnalysisModel<string, string>,
  projectResources: tropos4asProjectResourceParsers,
  // its models declare its dialect's kinds (artifacts, failures, errors, symptoms)
  fileKinds: true,
});

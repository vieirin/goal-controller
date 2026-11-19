import { defineEngine } from '../engine';
import { cgmCheckRegistry } from './checks';
import { cgm } from './definition';
import { cgmAnalyses, cgmProjectResourceParsers } from './index';
import { cgmAnalysisModel, cgmEngineMapper } from './mapper';

/**
 * Contextual goal models, as the workbench registers them
 * (goal-controller#153): an analysis engine (REJ 2010's reasoning: the
 * variants in a situation, the unadoptable and core variants, the
 * minimum-cost tasks; each case drawn as a selection), its models declaring
 * its dialect's kinds (contexts, statements, facts).
 */
export const cgmEngine = defineEngine({
  id: 'cgm',
  help: 'Contextual goal models (REJ 2010, IST 2013): contexts at the variation points of a Tropos model, with context analysis',
  dialect: cgm,
  checks: cgmCheckRegistry,
  mapper: cgmEngineMapper,
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/cgm/definition.ts',
    lists: {
      goal: 'properties.goal',
      task: 'properties.task',
      quality: 'properties.quality',
    },
    mapper: 'packages/lib/src/engines/cgm/mapper.ts',
  },
  output: { label: 'Variants', extension: 'txt', language: 'text' },
  analyses: cgmAnalyses,
  // a model of any framework, as the workbench parses it: the function at
  // string kinds (defineEngine infers no engine from a generic one beside
  // projectResources, goal-controller#185)
  analysisModel: cgmAnalysisModel<string, string>,
  projectResources: cgmProjectResourceParsers,
  // its models declare its dialect's kinds (contexts, statements, facts)
  fileKinds: true,
});

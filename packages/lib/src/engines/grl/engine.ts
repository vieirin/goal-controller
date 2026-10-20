import { defineEngine } from '../engine';
import { grlCheckRegistry } from './checks';
import { grl } from './definition';
import { grlAnalyses, grlProjectResourceParsers } from './index';
import { grlAnalysisModel, grlEngineMapper } from './mapper';

/**
 * GRL, as the workbench registers it: an analysis engine (its values are
 * drawn on the model, Analyse; no file), its models declaring GRL's kinds
 * (its dialect's extension).
 */
export const grlEngine = defineEngine({
  id: 'grl',
  help: "GRL (jUCMNav): evaluates the model under its strategies, jUCMNav's quantitative and qualitative propagation, the values drawn on the model",
  dialect: grl,
  checks: grlCheckRegistry,
  mapper: grlEngineMapper,
  output: { label: 'Evaluation', extension: 'json', language: 'text' },
  analyses: grlAnalyses,
  // a model of any framework, as the workbench parses it: the function at
  // string kinds (defineEngine infers no engine from a generic one beside
  // projectResources, goal-controller#185)
  analysisModel: grlAnalysisModel<string, string>,
  projectResources: grlProjectResourceParsers,
  // its models declare its dialect's kinds (the indicator, the belief)
  fileKinds: true,
});

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
  analysisModel: grlAnalysisModel,
  projectResources: grlProjectResourceParsers,
  // its models declare its dialect's kinds (the indicator, the belief)
  fileKinds: true,
});

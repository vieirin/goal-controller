import { defineEngine } from '../engine';
import { kaosexpert } from './definition';
import { kaosexpertAnalyses, kaosexpertProjectResourceParsers } from './index';
import { kaosexpertAnalysisModel, kaosexpertEngineMapper } from './mapper';
import { kaosexpertOptions } from './options';

/**
 * kaosexpert, as the workbench registers it (goal-controller#190): an
 * analysis engine (each goal's satisfaction uncertainty is drawn on the
 * model, Analyse; no file), RE'15's expert combination and Monte Carlo
 * over kaosprop's obstacle model.
 */
export const kaosexpertEngine = defineEngine({
  id: 'kaosexpert',
  label: 'KAOS expert estimates and uncertainty',
  help: "Cailliau and van Lamsweerde's handling of knowledge uncertainty (RE'15): the experts' estimates combined by Cooke's model, each goal's probability of satisfaction sampled by Monte Carlo over its obstacles' BDD, with its violation uncertainty and uncertainty spread against its required rate, and the critical obstacles",
  dialect: kaosexpert,
  mapper: kaosexpertEngineMapper,
  output: { label: 'Uncertainty', extension: 'json', language: 'text' },
  analyses: kaosexpertAnalyses,
  analysisModel: kaosexpertAnalysisModel<string, string>,
  projectResources: kaosexpertProjectResourceParsers,
  options: kaosexpertOptions,
});

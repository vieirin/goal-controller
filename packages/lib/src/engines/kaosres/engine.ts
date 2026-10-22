import { defineEngine } from '../engine';
import { kaosres } from './definition';
import { kaosresAnalyses } from './index';
import { kaosresAnalysisModel, kaosresEngineMapper } from './mapper';
import { kaosresOptions } from './options';

/**
 * kaosres, as the workbench registers it (goal-controller#191): an
 * analysis engine (its selections are drawn on the model, Analyse; no
 * file), Cailliau and van Lamsweerde's countermeasure selection (SEAMS'17)
 * over kaosprop's obstacle analysis.
 */
export const kaosresEngine = defineEngine({
  id: 'kaosres',
  label: 'KAOS countermeasure selection',
  help: "Cailliau and van Lamsweerde's selection of countermeasures to obstacles (SEAMS'17): each selection of resolutions integrated into the model and propagated, the safe, consistent and cost-optimal ones, and the one of lowest cost that maximises the high-level goals' satisfaction",
  dialect: kaosres,
  mapper: kaosresEngineMapper,
  output: { label: 'Selections', extension: 'json', language: 'text' },
  analyses: kaosresAnalyses,
  analysisModel: kaosresAnalysisModel,
  options: kaosresOptions,
});

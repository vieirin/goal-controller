import { defineEngine } from '../engine';
import { kaossim } from './definition';
import { kaossimAnalyses, kaossimProjectResourceParsers } from './index';
import { kaossimAnalysisModel, kaossimEngineMapper } from './mapper';
import { kaossimOptions } from './options';

/**
 * kaossim, as the workbench registers it (goal-controller#193): an analysis
 * engine (each design's objective functions are drawn on the model,
 * Analyse; no file), FSE'04's quantitative goal models simulated by Monte
 * Carlo as RE'11 does, and the Pareto-optimal designs.
 */
export const kaossimEngine = defineEngine({
  id: 'kaossim',
  label: 'KAOS quantitative goals',
  help: "Letier and van Lamsweerde's partial goal satisfaction (FSE'04), simulated as Heaven and Letier do (RE'11): quality variables, refinement equations and leaf estimates, each design's objective functions by Monte Carlo, and the Pareto-optimal designs, by every design or by NSGA-II",
  dialect: kaossim,
  mapper: kaossimEngineMapper,
  output: { label: 'Designs', extension: 'json', language: 'text' },
  analyses: kaossimAnalyses,
  analysisModel: kaossimAnalysisModel,
  projectResources: kaossimProjectResourceParsers,
  options: kaossimOptions,
});

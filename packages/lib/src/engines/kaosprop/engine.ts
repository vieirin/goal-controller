import { defineEngine } from '../engine';
import { kaosprop } from './definition';
import { kaospropAnalyses } from './index';
import { kaospropAnalysisModel, kaospropEngineMapper } from './mapper';

/**
 * kaosprop, as the workbench registers it (goal-controller#181): an
 * analysis engine (its probabilities are drawn on the model, Analyse; no
 * file), Cailliau and van Lamsweerde's probabilistic obstacle analysis.
 */
export const kaospropEngine = defineEngine({
  id: 'kaosprop',
  label: 'KAOS obstacle probabilities',
  help: "Cailliau and van Lamsweerde's probabilistic obstacle analysis (RE'12): each obstacle's probability and each goal's estimated probability of satisfaction against its required rate, step by step, and the critical obstacle combinations",
  dialect: kaosprop,
  mapper: kaospropEngineMapper,
  output: { label: 'Probabilities', extension: 'json', language: 'text' },
  analyses: kaospropAnalyses,
  analysisModel: kaospropAnalysisModel,
});

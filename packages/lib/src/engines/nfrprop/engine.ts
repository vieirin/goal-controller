import { defineEngine } from '../engine';
import { nfrprop } from './definition';
import { nfrpropAnalyses } from './index';
import { nfrpropAnalysisModel, nfrpropEngineMapper } from './mapper';

/**
 * nfrprop, as the workbench registers it (goal-controller#171): an analysis
 * engine (its labels are drawn on the model, Analyse; no file), the NFR
 * Framework's label propagation.
 */
export const nfrpropEngine = defineEngine({
  id: 'nfrprop',
  label: 'NFR propagation',
  help: "The NFR Framework's label propagation (Chung et al.): each softgoal satisficed, denied, in conflict or undecided, step by step, drawn on the model",
  dialect: nfrprop,
  mapper: nfrpropEngineMapper,
  output: { label: 'Labels', extension: 'json', language: 'text' },
  analyses: nfrpropAnalyses,
  analysisModel: nfrpropAnalysisModel,
});

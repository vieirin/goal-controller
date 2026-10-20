import { defineEngine } from '../engine';
import { nfrprop } from './definition';
import { nfrpropAnalyses, nfrpropProjectResourceParsers } from './index';
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
  // a model of any framework, as the workbench parses it: the function at
  // string kinds (defineEngine infers no engine from a generic one beside
  // projectResources, goal-controller#185)
  analysisModel: nfrpropAnalysisModel<string, string>,
  projectResources: nfrpropProjectResourceParsers,
});

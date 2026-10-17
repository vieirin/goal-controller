/**
 * nfrprop (goal-controller#171): the NFR Framework's label propagation, an
 * analysis engine.
 *
 * - labels.ts: the labels and the propagation rules (Chung et al. 2000)
 * - propagation.ts: the analysis over the model, with its steps
 * - definition.ts: its dialect, `nfr` with each element's initial label
 * - mapper.ts: how goal-tree reads an NFR model for it
 */
import { defineAnalyses } from '../analysis';
import { nfrprop } from './definition';
import { runPropagation } from './propagation';

export const nfrpropAnalyses = defineAnalyses(nfrprop, {
  nfrLabels: { label: 'NFR label propagation', run: runPropagation },
});

export { nfrprop } from './definition';
export {
  combined,
  impact,
  NFR_CONTRIBUTION_OF,
  NFR_LABEL_SYMBOL,
  NFR_LABELS,
  refined,
  type NfrContribution,
  type NfrLabel,
} from './labels';
export { labelValue, propagateLabels, runPropagation } from './propagation';
export {
  nfrpropAnalysisModel,
  nfrpropEngineMapper,
  readNfrModel,
} from './mapper';

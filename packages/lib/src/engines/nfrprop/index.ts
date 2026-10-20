/**
 * nfrprop (goal-controller#171): the NFR Framework's label propagation, an
 * analysis engine.
 *
 * - labels.ts: the labels and the propagation rules (Chung et al. 2000)
 * - propagation.ts: the analysis over the model, with its steps
 * - definition.ts: its dialect, `nfr` with each element's initial label
 * - strategies.ts: its strategies, a project resource (goal-controller#328)
 * - mapper.ts: how goal-tree reads an NFR model for it
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import { nfrprop } from './definition';
import { runPropagation } from './propagation';
import { parseNfrStrategies } from './strategies';

export const nfrpropAnalyses = defineAnalyses(nfrprop, {
  nfrLabels: {
    label: 'NFR label propagation',
    input: 'strategies',
    run: runPropagation,
  },
});

export const nfrpropProjectResourceParsers = projectResourceParsers(nfrprop)({
  strategies: parseNfrStrategies,
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
export {
  labelValue,
  modelLabels,
  propagateLabels,
  runPropagation,
} from './propagation';
export {
  parseNfrStrategies,
  readNfrStrategies,
  type NfrStrategy,
  type NfrStrategyFile,
} from './strategies';
export {
  nfrpropAnalysisModel,
  nfrpropEngineMapper,
  readNfrModel,
  type NfrpropElementProps,
  type NfrpropGoalModel,
  type NfrpropNode,
} from './mapper';

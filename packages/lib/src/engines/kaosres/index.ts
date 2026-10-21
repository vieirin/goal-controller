/**
 * kaosres (goal-controller#191): countermeasures to obstacles (Cailliau and
 * van Lamsweerde, SEAMS'17) over kaosprop's obstacle model.
 *
 * - definition.ts: its dialect, kaosprop's with a resolution's `Cost`,
 *   `Form` and the form's payload (D1)
 * - transform.ts: what applying a countermeasure does to the model, per
 *   TSE'00 strategy and per form, in memory (D2): the variants kaosprop
 *   propagates
 * - selection.ts: the selection, safe, consistent and cost-optimal, as
 *   SEAMS'17 defines them (D4), or as KAOSTools computes it
 * - options.ts, mapper.ts, engine.ts: the engine the workbench registers
 */
import { defineAnalyses } from '../analysis';
import {
  runCriticalCombinations,
  runPropagation,
} from '../kaosprop/propagation';
import { kaosres } from './definition';
import { runSelection } from './selection';

export const kaosresAnalyses = defineAnalyses(kaosres, {
  selection: {
    label: 'Countermeasure selection',
    run: runSelection,
  },
  probabilities: {
    label: 'Obstacle and goal probabilities',
    run: runPropagation,
  },
  criticalCombinations: {
    label: 'Critical obstacle combinations',
    run: runCriticalCombinations,
  },
});

export {
  COUNTERMEASURE_FORMS,
  kaosres,
  type CountermeasureForm,
} from './definition';
export {
  applyCountermeasures,
  applyCountermeasuresToView,
  countermeasuresOf,
  FORM_INTEGRATIONS,
  integrationOf,
  kaosModelOfView,
  kaosresView,
  obstructs,
  STRATEGY_INTEGRATIONS,
  type AppliedCountermeasure,
  type ApplyOptions,
  type Countermeasure,
  type CountermeasureProblem,
  type CountermeasureVariant,
  type Integration,
  type KaosElementKind,
  type KaosLinkKind,
  type KaosModel,
  type ResolutionScope,
  type ResolutionStrategy,
} from './transform';
export {
  DEFAULT_SELECTION_OPTIONS,
  runSelection,
  selectCountermeasures,
  selectionOptionsOf,
  type CountermeasureGoal,
  type Selection,
  type SelectionOptions,
  type SelectionResult,
  type SelectionSemantics,
} from './selection';
export { kaosresOptions } from './options';
export { kaosresAnalysisModel, kaosresEngineMapper } from './mapper';

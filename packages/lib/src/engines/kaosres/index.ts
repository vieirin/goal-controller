/**
 * kaosres (goal-controller#191): countermeasures to obstacles (Cailliau and
 * van Lamsweerde, SEAMS'17) over kaosprop's obstacle model.
 *
 * - definition.ts: its dialect, kaosprop's with a resolution's `Cost`,
 *   `Form` and the form's payload (D1)
 * - transform.ts: what applying a countermeasure does to the model, per
 *   TSE'00 strategy and per form, in memory (D2): the variants kaosprop
 *   propagates
 *
 * The selection (safe, consistent, cost-optimal) and the engine are part B.
 */
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

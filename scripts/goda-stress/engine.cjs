/**
 * The GODA engine as the stress test calls it: one adapter over lib's
 * exports (goal-controller#32), so the harness needs nothing else of the
 * engine. Until the engine is in the built lib, there is none, and every
 * check that needs it is reported `unavailable`.
 *
 * What it reads of lib (#32's names):
 * - `goda`: the dialect's definition (elements, notation, properties);
 * - `godaCheckRegistry`: its named checks (none: no named checks run);
 * - `godaOutput(model, { modelName, variant })`: an EngineOutput (#33) of the
 *   validated model (it names the .nm after the actor of the selected goal,
 *   which the tree doesn't keep): the MDP, the four PCTL files, both formulas
 *   and eval_formula.sh; `variant` is the generator version to reproduce
 *   (#34 D10). What it doesn't generate yet throws a `GodaUnsupported` error
 *   naming the issue that will;
 * - `GODA_IMPLEMENTED_VARIANTS`: the variants it implements (none listed:
 *   the January 2019 one, `cc808b6`, the base PR's).
 */
const godaEngine = (lib) => {
  // the dialect alone (no godaOutput yet): the language's checks still run
  if (!lib.goda) return null;
  return {
    definition: lib.goda,
    checks: lib.godaCheckRegistry ?? {},
    output:
      typeof lib.godaOutput === 'function'
        ? (model, options) => lib.godaOutput(model, options)
        : null,
    implements: (variant) =>
      (lib.GODA_IMPLEMENTED_VARIANTS ?? ['cc808b6']).includes(variant),
  };
};

module.exports = { godaEngine };

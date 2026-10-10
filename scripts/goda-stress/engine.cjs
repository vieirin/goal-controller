/**
 * The GODA engine as the stress test calls it: one adapter over lib's
 * exports (goal-controller#32), so the harness needs nothing else of the
 * engine. Until the engine is in the built lib, there is none, and every
 * check that needs it is reported `unavailable`.
 *
 * What it reads of lib (#32's names):
 * - `goda`: the dialect's definition (elements, notation, properties);
 * - `godaCheckRegistry`: its named checks (none: no named checks run);
 * - `godaEngineMapper`: the mapper the engine's tree is read with;
 * - `godaOutput(tree, { modelName })`: an EngineOutput (#33), the MDP, the
 *   four PCTL files and both formulas among its files.
 */
const godaEngine = (lib) => {
  if (
    typeof lib.godaOutput !== 'function' ||
    !lib.goda ||
    !lib.godaEngineMapper
  )
    return null;
  return {
    definition: lib.goda,
    checks: lib.godaCheckRegistry ?? {},
    mapper: lib.godaEngineMapper,
    output: (tree, options) => lib.godaOutput(tree, options),
  };
};

module.exports = { godaEngine };

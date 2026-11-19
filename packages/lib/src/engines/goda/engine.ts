import { optionOr, onTree } from '../run';
import { GODA_DEFAULT_VARIANT, godaGoalModel, godaOutput } from './template';
import { defineEngine } from '../engine';
import { godaCheckRegistry } from './checks';
import { goda } from './definition';
import { godaEngineMapper } from './mapper';
import { godaOptions } from './options';

/** GODA-MDP, as the workbench registers it. */
export const godaEngine = defineEngine({
  id: 'goda',
  help: 'GODA-MDP: the PRISM MDP, its properties and its parametric reliability and cost formulas',
  dialect: goda,
  checks: godaCheckRegistry,
  mapper: godaEngineMapper,
  // its tree checks the model; it reads the model as written, and names its
  // MDP after the actor
  run: onTree(godaEngineMapper, {
    generate: (_tree, { model, modelName, options }) =>
      godaOutput(godaGoalModel(model), {
        modelName,
        variant: optionOr(options, 'variant', GODA_DEFAULT_VARIANT),
        runtimeFormulas: optionOr(options, 'runtimeFormulas', false),
      }),
  }),
  // the actor's MDP; its PCTL properties and parametric formulas are its other files
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/goda/definition.ts',
    lists: { goal: 'goalProperties', task: 'taskProperties' },
    mapper: 'packages/lib/src/engines/goda/mapper.ts',
  },
  output: { label: 'PRISM MDP', extension: 'nm', language: 'prism' },
  outputs: [
    { id: 'model', language: 'prism' },
    { id: 'reachability-max', language: 'pctl' },
    { id: 'reachability-min', language: 'pctl' },
    { id: 'cost-max', language: 'pctl' },
    { id: 'cost-min', language: 'pctl' },
    { id: 'reliability', language: 'text' },
    { id: 'cost', language: 'text' },
    { id: 'evaluate', language: 'shell' },
    // with the runtimeFormulas option (SA-BSN's runtime, goal-controller#94)
    { id: 'runtime-reliability', language: 'text' },
    { id: 'runtime-cost', language: 'text' },
  ],
  options: godaOptions,
});

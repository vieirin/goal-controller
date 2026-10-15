import { defineEngine } from '../engine';
import { godaCheckRegistry } from './checks';
import { goda } from './definition';
import { godaEngineMapper } from './mapper';

/** GODA-MDP, as the workbench registers it. */
export const godaEngine = defineEngine({
  id: 'goda',
  help: 'GODA-MDP: the PRISM MDP, its properties and its parametric reliability and cost formulas',
  dialect: goda,
  checks: godaCheckRegistry,
  mapper: godaEngineMapper,
  // the actor's MDP; its PCTL properties and parametric formulas are its other files
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
  options: true,
});

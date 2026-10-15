import { defineEngine } from '../engine';
import { sleecEngineMapper } from './mapper';
import { sleecOptions } from './options';

/**
 * SLEEC, as the workbench registers it: no dialect of its own (its view reads
 * goal texts in Edge's).
 */
export const sleecEngine = defineEngine({
  id: 'sleec',
  label: 'SLEEC',
  help: 'SLEEC rules from the goal conditions',
  mapper: sleecEngineMapper,
  output: { label: 'SLEEC', extension: 'sleec', language: 'text' },
  outputs: [{ id: 'specification', language: 'sleec' }],
  options: sleecOptions,
});

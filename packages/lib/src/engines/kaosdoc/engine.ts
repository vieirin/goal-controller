import { kaos } from '../../dialects/kaos';
import { defineEngine } from '../engine';
import { kaosdocEngineMapper } from './mapper';

/**
 * kaosdoc, as the workbench registers it (goal-controller#171): KAOS's
 * first engine, a requirements document from a KAOS model, read in the
 * `kaos` dialect (its properties, checks none).
 */
export const kaosdocEngine = defineEngine({
  id: 'kaosdoc',
  label: 'KAOS document',
  help: 'A requirements document from the KAOS model: goals with their fit criteria, refinements, requirements and expectations, agents, conflicts',
  dialect: kaos,
  mapper: kaosdocEngineMapper,
  output: { label: 'Requirements document', extension: 'md', language: 'text' },
  outputs: [{ id: 'document', language: 'text' }],
});

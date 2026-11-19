import { onModel } from '../run';
import { kaosdocGoalModel } from './mapper';
import { kaosdocOutput } from './template';
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
  // the model's IR: its hubs, agents and conflicts too
  run: onModel(kaosdocGoalModel, {
    generate: (goalModel, { modelName }) =>
      kaosdocOutput(goalModel, { modelName }),
  }),
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/dialects/kaos/index.ts',
    lists: {},
    mapper: 'packages/lib/src/engines/kaosdoc/mapper.ts',
  },
  output: { label: 'Requirements document', extension: 'md', language: 'text' },
  outputs: [{ id: 'document', language: 'text' }],
});

import { optionOr, onTree } from '../run';
import { sleecOutput } from './template';
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
  run: onTree(sleecEngineMapper, {
    generate: (tree, { modelName, options }) =>
      sleecOutput(tree, {
        modelName,
        generateFluents: optionOr(options, 'generateFluents', true),
      }),
  }),
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/sleec/mapper.ts',
    lists: {
      goal: 'SLEEC_GOAL_KEYS',
      task: 'SLEEC_TASK_KEYS',
      quality: 'SLEEC_QUALITY_KEYS',
    },
    mapper: 'packages/lib/src/engines/sleec/mapper.ts',
  },
  output: { label: 'SLEEC', extension: 'sleec', language: 'text' },
  outputs: [{ id: 'specification', language: 'sleec' }],
  options: sleecOptions,
});

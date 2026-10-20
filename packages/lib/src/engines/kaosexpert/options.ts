/**
 * kaosexpert's options (goal-controller#190, D4): the Monte Carlo's sample
 * count and seed (a run is reproducible), and how the experts are weighed.
 */
import { defineOptions } from '@goal-controller/dialect';
import { DEFAULT_EXPERT_OPTIONS } from './propagation';

export const kaosexpertOptions = defineOptions([
  {
    key: 'samples',
    label: 'Samples',
    help: 'how many times the Monte Carlo draws every estimate (RE’15 §VI.C)',
    value: { type: 'int', min: 1, max: 1000000 },
    default: DEFAULT_EXPERT_OPTIONS.samples,
    summary: '{value} samples',
  },
  {
    key: 'seed',
    label: 'Seed',
    help: 'the random draws’ seed: the same seed, the same results',
    value: { type: 'int', min: 0, max: 2147483647 },
    default: DEFAULT_EXPERT_OPTIONS.seed,
  },
  {
    key: 'weighting',
    label: 'Expert weighting',
    help: 'how the experts’ estimates are combined',
    value: {
      type: 'enum',
      options: [
        {
          value: 're15',
          label: 'Cooke, as RE’15',
          help: 'Cooke’s classical model as RE’15’s tool scores it (calibration and information over every estimated variable)',
        },
        {
          value: 'classical',
          label: 'Cooke, classical',
          help: 'Cooke’s classical model as Cooke (1991) defines it: calibration variables only',
        },
        {
          value: 'equal',
          label: 'Equal weights',
          help: 'every expert the same weight',
        },
      ],
    },
    default: DEFAULT_EXPERT_OPTIONS.weighting,
    summary: '{value}',
  },
]);

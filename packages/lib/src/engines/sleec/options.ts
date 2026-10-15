/** SLEEC's generation options (goal-controller#118). */
import { defineOptions } from '@goal-controller/dialect';
import { reduceOption } from '../options';

export const sleecOptions = defineOptions([
  {
    key: 'generateFluents',
    label: 'Generate fluent definitions',
    value: { type: 'bool' },
    default: false,
    summary: 'with fluents',
  },
  reduceOption,
]);

import { defineDialect } from '@goal-controller/dialect';
import { edgeFamily, edgeNotation } from '../edgeFamily/definition';

/**
 * EdgeV2 (packages/lib/grammar/edgeV2/RTRegex.g4): the goal language's
 * operators it reads, and the construct each one is. How tightly they bind is
 * the language's (`@ > | > ? > + > # > ; > ->`, RTRegex.g4's order).
 */
export const edgeV2 = defineDialect({
  id: 'edgeV2',
  name: 'EdgeV2',
  ...edgeFamily,
  notation: {
    ...edgeNotation,
    operators: {
      '@': 'retry',
      '|': 'alternative',
      '?': 'choice',
      '+': 'anyOrder',
      '#': 'interleaved',
      ';': 'sequence',
      '->': 'degradation',
    },
  },
});

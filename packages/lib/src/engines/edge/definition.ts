import { defineDialect } from '@goal-controller/dialect';
import { edgeFamily, edgeNotation } from '../edgeFamily/definition';

/**
 * Edge (v1, packages/lib/grammar/edge/RTRegex.g4): EdgeV2's operators but
 * `?` and `+`; a choice is a standalone `+` (`[+]`).
 */
export const edge = defineDialect({
  id: 'edge',
  name: 'Edge',
  ...edgeFamily,
  notation: {
    ...edgeNotation,
    operators: {
      '@': 'retry',
      '|': 'alternative',
      '#': 'interleaved',
      ';': 'sequence',
      '->': 'degradation',
    },
    standalone: { '+': 'choice' },
  },
});

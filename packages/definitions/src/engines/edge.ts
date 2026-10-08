import { defineEngine } from '../schema';
import { RETRY, edgeFamily, edgeNotation } from './edgeShared';

/**
 * Edge (v1): packages/lib/grammar/edge/RTRegex.g4. Its operators in the
 * grammar's alternative order; a choice is a standalone `+` (`[+]`).
 */
export const edge = defineEngine({
  id: 'edge',
  name: 'Edge',
  grammar: 'edge',
  parser: 'antlr',
  ...edgeFamily,
  notation: {
    ...edgeNotation,
    operators: [
      RETRY,
      { symbol: '|', form: 'infix', construct: 'alternative', assoc: 'left' },
      { symbol: '#', form: 'infix', construct: 'interleaved', assoc: 'left' },
      { symbol: ';', form: 'infix', construct: 'sequence', assoc: 'left' },
      { symbol: '->', form: 'infix', construct: 'degradation', assoc: 'left' },
      { symbol: '+', form: 'standalone', construct: 'choice', assoc: 'none' },
    ],
  },
});

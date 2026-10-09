import { defineDialect } from '@goal-controller/dialect';
import { RETRY, edgeFamily, edgeNotation } from '../edgeFamily/definition';

/**
 * EdgeV2: packages/lib/grammar/edgeV2/RTRegex.g4. Precedence, tightest first:
 * `@ > | > ? > + > # > ; > ->` (ANTLR's left-recursive alternative order).
 */
export const edgeV2 = defineDialect({
  id: 'edgeV2',
  name: 'EdgeV2',
  grammar: 'edgeV2',
  parser: 'antlr',
  ...edgeFamily,
  notation: {
    ...edgeNotation,
    operators: [
      RETRY,
      { symbol: '|', form: 'infix', construct: 'alternative', assoc: 'left' },
      { symbol: '?', form: 'infix', construct: 'choice', assoc: 'left' },
      { symbol: '+', form: 'infix', construct: 'anyOrder', assoc: 'left' },
      { symbol: '#', form: 'infix', construct: 'interleaved', assoc: 'left' },
      { symbol: ';', form: 'infix', construct: 'sequence', assoc: 'left' },
      { symbol: '->', form: 'infix', construct: 'degradation', assoc: 'left' },
    ],
  },
});

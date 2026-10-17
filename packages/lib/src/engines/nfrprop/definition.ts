/**
 * nfrprop's dialect (goal-controller#171): the `nfr` dialect, with the label
 * a developer gives an element before propagation (its `initialLabel`):
 * an operationalization chosen or rejected, a claim held or not, a
 * softgoal decided by hand. Unset, an operationalization or claim nothing
 * contributes to is satisficed (chosen, held), and every other element's
 * label is propagated (a softgoal nothing contributes to is undecided).
 */
import { defineDialect, property } from '@goal-controller/dialect';
import { nfr } from '../../dialects/nfr';
import { NFR_LABELS } from './labels';

const INITIAL_LABEL = property.enum(
  'initialLabel',
  [['', 'propagated (default)'], ...NFR_LABELS],
  {
    help: 'its label before propagation: an operationalization chosen (satisficed) or rejected (denied), a claim held or not; unset, an operationalization or claim nothing contributes to is satisficed, any other element propagated',
  },
);

export const nfrprop = defineDialect({
  ...nfr,
  id: 'nfrprop',
  name: 'NFR propagation',
  properties: {
    'nfr.NFR': [...nfr.properties['nfr.NFR'], INITIAL_LABEL],
    'nfr.Operationalization': [
      ...nfr.properties['nfr.Operationalization'],
      INITIAL_LABEL,
    ],
    'nfr.Claim': [...nfr.properties['nfr.Claim'], INITIAL_LABEL],
  },
  propertyLineOrder: [...nfr.propertyLineOrder, 'initialLabel'],
});

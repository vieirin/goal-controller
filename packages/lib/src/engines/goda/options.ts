/**
 * GODA's generation options (goal-controller#118). It reads the model as
 * written: no reduce.
 */
import { defineOptions } from '@goal-controller/dialect';

export const godaOptions = defineOptions([
  {
    key: 'variant',
    label: 'Generator version',
    help: 'the pistarGODA-MDP generator the output reproduces',
    // GODA_VARIANTS, the July 2019 one by default (#34 D24); a test pins them
    value: {
      type: 'enum',
      options: [
        {
          value: '5305bc1',
          label: 'July 2019',
          help: '5305bc1: no frequency parameter, guards after a sibling goal (TAS, Fragmented, BSN)',
        },
        {
          value: 'cc808b6',
          label: 'January 2019',
          help: 'cc808b6: a frequency parameter per task (AND, OR, DM, Incompleteness)',
        },
      ],
    },
    default: '5305bc1',
    summary: 'generator {value}',
  },
  {
    key: 'runtimeFormulas',
    label: 'Runtime formulas (reliability.formula, cost.formula)',
    // the formulas SA-BSN's runtime loads (goal-controller#94)
    value: { type: 'bool' },
    default: false,
    summary: 'runtime formulas',
  },
]);

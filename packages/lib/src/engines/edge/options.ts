/** Edge's generation options (goal-controller#118), in the order the options menu lists them. */
import { defineOptions } from '@goal-controller/dialect';
import { cleanOption, generateDecisionVarsOption } from '../edgeFamily/options';
import { reduceOption } from '../options';

export const edgeOptions = defineOptions([
  {
    key: 'achievabilitySpace',
    label: 'Achievability space',
    help: 'levels for decision variables',
    value: { type: 'int', min: 1, max: 100 },
    default: 4,
    summary: 'space {value}',
  },
  generateDecisionVarsOption,
  cleanOption,
  reduceOption,
]);

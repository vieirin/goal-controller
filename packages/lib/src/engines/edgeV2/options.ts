/** EdgeV2's generation options (goal-controller#118), in the order the options menu lists them. */
import { defineOptions } from '@goal-controller/dialect';
import { cleanOption, generateDecisionVarsOption } from '../edgeFamily/options';
import { reduceOption } from '../options';

export const edgeV2Options = defineOptions([
  {
    key: 'discretisation',
    label: 'Discretisation N',
    help: 'decisions compare achievability × N',
    value: { type: 'int', min: 1, max: 100 },
    default: 10,
    summary: 'N={value}',
  },
  {
    key: 'taskLayout',
    label: 'Task layout',
    value: {
      type: 'enum',
      options: [
        {
          value: 'taskModules',
          label: 'Module per task',
          help: 'One module per task, next to its goal (EDGE reference)',
        },
        {
          value: 'changeManager',
          label: 'ChangeManager',
          help: 'All tasks in one ChangeManager module',
        },
      ],
    },
    default: 'taskModules',
    summary: '{value}',
  },
  generateDecisionVarsOption,
  cleanOption,
  reduceOption,
]);

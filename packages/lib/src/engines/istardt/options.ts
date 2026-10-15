/**
 * iStar-DT's generation options (goal-controller#119): the iStarDT-X file's
 * `<options>`, which the importer records as the project's. The writer
 * reads the model as written: no reduce.
 */
import { defineOptions } from '@goal-controller/dialect';

/** The penalty DT-Golog's interface gives an infeasible action when the file sets none. */
export const DEFAULT_INFEASIBLE_PENALTY = 100;

export const istardtOptions = defineOptions([
  {
    key: 'continuous',
    label: 'Continuous observations',
    help: 'the RL agent observes the exported qualities and variables as numbers (getObsType(continuous)); off: discrete',
    value: { type: 'bool' },
    default: true,
  },
  {
    key: 'infeasibleActionPenalty',
    label: 'Infeasible action penalty',
    help: 'the reward an agent loses for an action whose preconditions don’t hold',
    value: { type: 'number' },
    default: DEFAULT_INFEASIBLE_PENALTY,
    summary: 'penalty {value}',
  },
]);

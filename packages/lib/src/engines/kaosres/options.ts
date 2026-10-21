/**
 * kaosres's options (goal-controller#191 part B): where an integration's
 * obstacle is false, whose selection rules apply, and how many selections
 * the search evaluates at most (./selection.ts).
 */
import { defineOptions } from '@goal-controller/dialect';
import { DEFAULT_SELECTION_OPTIONS } from './selection';

export const kaosresOptions = defineOptions([
  {
    key: 'scope',
    label: 'Resolved where',
    help: 'where a kept obstructed goal no longer sees its obstacle',
    value: {
      type: 'enum',
      options: [
        {
          value: 'anchor',
          label: 'Below the anchor',
          help: 'SEAMS’17 §VI.A and the thesis: the obstacle is false below the anchor goal',
        },
        {
          value: 'model',
          label: 'Everywhere',
          help: 'KAOSTools’ integrator: the obstacle resolved is false in the whole model',
        },
      ],
    },
    default: DEFAULT_SELECTION_OPTIONS.scope,
    summary: '{value}',
  },
  {
    key: 'semantics',
    label: 'Selection rules',
    help: 'whose definitions of a safe, consistent, cost-optimal selection apply',
    value: {
      type: 'enum',
      options: [
        {
          value: 'seams17',
          label: 'SEAMS’17',
          help: 'the paper’s: conflicting countermeasures never together, the empty selection a candidate',
        },
        {
          value: 'kaostools',
          label: 'KAOSTools (2017)',
          help: 'its NaiveCountermeasureSelectionOptimizer’s: no consistency, non-empty selections, the best one when the minimal cost is 0 or none is safe',
        },
      ],
    },
    default: DEFAULT_SELECTION_OPTIONS.semantics,
    summary: '{value}',
  },
  {
    key: 'limit',
    label: 'Selections evaluated, at most',
    help: 'the search evaluates selections in the order of their cost, at most this many (2ⁿ for n countermeasures)',
    value: { type: 'int', min: 1, max: 1048576 },
    default: DEFAULT_SELECTION_OPTIONS.limit,
    summary: '{value} selections',
  },
]);

/**
 * The generation options engines share (goal-controller#118): each engine
 * declares its own list, with these where it reads them.
 */
import type { OptionDefinition } from '@goal-controller/dialect';

/** Generate from the model without its single-child goals (goal-tree's `Model.reduce`). */
export const reduceOption = {
  key: 'reduce',
  label: 'Reduce single-child goals',
  help: 'Generate without the goals that have a single child',
  value: { type: 'bool' },
  default: false,
  summary: 'reduced',
  confirm: {
    text: [
      "Before generating, every goal with a single child is removed, and its child is linked to the first parent with more than one child (or to the root), with that parent's AND/OR refinement. The parent's notation names the child in place of the removed goal.",
      'The properties of a removed goal (conditions, utility, cost, …) and its other links are not generated. Only the generated output changes: the model and the diagram stay as they are.',
    ],
    action: 'Reduce',
  },
} as const satisfies OptionDefinition;

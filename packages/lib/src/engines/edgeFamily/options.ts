/** The options both Edge engines' PRISM generators read (goal-controller#118). */
import type { OptionDefinition } from '@goal-controller/dialect';

export const generateDecisionVarsOption = {
  key: 'generateDecisionVars',
  label: 'Decision variables',
  value: { type: 'bool' },
  default: true,
} as const satisfies OptionDefinition;

export const cleanOption = {
  key: 'clean',
  label: 'Clean mode (no comments)',
  value: { type: 'bool' },
  default: false,
} as const satisfies OptionDefinition;

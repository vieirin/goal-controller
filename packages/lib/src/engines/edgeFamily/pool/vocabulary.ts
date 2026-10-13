/**
 * The Edge engines' vocabulary on the definition pool: the kinds their
 * files define and #58's checks, each named once, and the annotations
 * typed by them.
 */
import { annotationsFor, type KindDeclaration } from '../../../pool';

export const KINDS = {
  // ids are the diagram's: not renamed here
  'gm.goal': { label: 'Goal', rename: false },
  'gm.task': { label: 'Task', rename: false },
  'gm.resource': { label: 'Resource', rename: false },
  'edge.variable': {
    label: 'Variable',
    // a JSON key: no quote or backslash
    rename: (name: string) => (/^[^"\\]+$/.test(name) ? name : null),
  },
} as const satisfies Record<string, KindDeclaration>;

/** #58's checks */
export const MESSAGES = {
  'assertion-order-on-boolean': '{name} is a boolean: compare it with = or !=',
  'assertion-boolean-on-number':
    '{name} is a number ({type}): compare it with a number',
  'assertion-number-on-boolean':
    '{name} is a boolean: compare it with true or false',
  'assertion-needs-boolean':
    '{name} is a number ({type}): a condition needs a boolean',
  'assertion-int-with-decimal': '{name} is an int: compared with a decimal',
} as const;

export type EdgeKind = keyof typeof KINDS;
export type EdgeCheck = keyof typeof MESSAGES;

export const { defines, refersTo, langium, written } = annotationsFor(
  KINDS,
  MESSAGES,
);

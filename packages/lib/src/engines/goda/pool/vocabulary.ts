/**
 * GODA's vocabulary on the definition pool: its kinds and its check, each
 * named once, and the annotations typed by them.
 */
import { annotationsFor, type KindDeclaration } from '../../../pool';

export const KINDS = {
  // ids are the diagram's, scoped by their goal (BSN's G3/T1.2): not renamed here
  'gm.goal': { label: 'Goal', rename: false },
  'gm.task': { label: 'Task', rename: false },
  // a child an element's notation names (`[G1;G2]`), among its own
  'gm.child': { label: 'child', scope: 'owner', rename: false },
  'gm.variable': {
    label: 'Context variable',
    rename: (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : null),
  },
} as const satisfies Record<string, KindDeclaration>;

export const MESSAGES = {
  // a variable used both as a boolean and as a number (#58): an error on every use
  'assertion-type-conflict': '{name} is used both as a boolean and as a number',
} as const;

export type GodaKind = keyof typeof KINDS;
export type GodaCheck = keyof typeof MESSAGES;

export const { defines, goalModel, langium, written } = annotationsFor(
  KINDS,
  MESSAGES,
);

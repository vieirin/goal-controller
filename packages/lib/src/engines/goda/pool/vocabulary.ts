/**
 * GODA's vocabulary on the definition pool: its kind and its check, each
 * named once, and the annotations typed by them.
 */
import { annotationsFor, type KindDeclaration } from '../../../pool';

export const KINDS = {
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

export const { defines, langium, written } = annotationsFor(KINDS, MESSAGES);

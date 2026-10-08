import type { LanguageDefinition } from '../schema';

/**
 * The assertion language Edge property conditions are written in
 * (packages/lib/grammar/AssertionRegex.g4): `battery > 20 & !charging`.
 */
export const assertionLanguage = {
  // '&' binds tighter than '|'; '!' negates everything after it
  operators: [
    { symbol: '&', form: 'infix' },
    { symbol: '|', form: 'infix' },
    { symbol: '!', form: 'prefix' },
  ],
  parens: ['(', ')'],
  comparators: ['=', '!=', '<', '<=', '>', '>='],
  literals: {
    // AssertionRegex.g4's INT has no zero (`x > 0` does not parse there
    // either): the original grammar's quirk, kept so the editors read what
    // the engine reads
    int: '[1-9][0-9]*',
    bool: 'true|false',
  },
  keywords: ['true', 'false'],
  identifier: '[a-zA-Z_][a-zA-Z0-9_]*',
  resolves: ['resource', 'variable'],
} as const satisfies LanguageDefinition;

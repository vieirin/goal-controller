/**
 * GODA on the definition pool: the goal model, whose context conditions
 * declare their variables by using them; a variable used both as a
 * boolean and as a number is an error on every use (#58).
 */
import { assertionUse, usedAs } from '../../assertionUses';
import {
  declarePool,
  poolOf,
  type Check,
  type Definition,
  type TypedPool,
} from '../../../pool';
import { goalModel } from '../files/goalModel';
import { KINDS, MESSAGES, type GodaCheck, type GodaKind } from './vocabulary';

/** every use of a variable: its first (the definition), and the references to it */
const usesOf = (
  pool: TypedPool<GodaKind, GodaCheck>,
  variable: Definition<GodaKind, GodaCheck>,
) =>
  [variable, ...pool.referencesTo(variable)].flatMap(
    (located) => assertionUse(located) ?? [],
  );

const typeConflict: Check<GodaKind, GodaCheck> = (pool) =>
  pool.definitions('gm.variable').flatMap((variable) => {
    const uses = usesOf(pool, variable);
    return new Set(uses.map(usedAs)).size > 1
      ? uses.map(({ located }) =>
          located.problem('error', 'assertion-type-conflict', {
            name: variable.name,
          }),
        )
      : [];
  });

export const godaPoolDeclaration = declarePool({
  files: [goalModel],
  kinds: KINDS,
  checks: [typeConflict],
  messages: MESSAGES,
});

export const godaPool = poolOf(godaPoolDeclaration);

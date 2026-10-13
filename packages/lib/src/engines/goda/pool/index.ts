/**
 * GODA on the definition pool: the goal model, whose context conditions
 * declare their variables by using them; a variable used both as a
 * boolean and as a number is an error on every use (#58).
 */
import { assertionUse, usedAs, type AssertionUse } from '../../assertionUses';
import {
  defineEngine,
  poolOf,
  type Check,
  type Definition,
} from '../../../pool';
import { goalModel } from '../files/goalModel';

/** every use of a variable: its first (the definition), and the references to it */
const usesOf = (
  pool: Parameters<Check>[0],
  variable: Definition,
): AssertionUse[] =>
  [variable, ...pool.referencesTo(variable)].flatMap(
    (located) => assertionUse(located) ?? [],
  );

const typeConflict: Check = (pool) =>
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

export const godaEngine = defineEngine({
  files: [goalModel],
  kinds: {
    'gm.variable': {
      label: 'Context variable',
      rename: (name) => (/^[A-Za-z_]\w*$/.test(name) ? name : null),
    },
  },
  checks: [typeConflict],
  messages: {
    'assertion-type-conflict':
      '{name} is used both as a boolean and as a number',
  },
});

export const godaPool = poolOf(godaEngine);

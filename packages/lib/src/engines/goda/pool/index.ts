/**
 * GODA's definition pool: the goal model, whose context conditions declare
 * their variables by using them (#58). A variable is defined where it is
 * first used, every later use refers to it, and its type is what its uses
 * say: a variable used both as a boolean and as a number is an error on
 * every use.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import {
  assertionUsesIn,
  createModelProvider,
  definePool,
  isAssertionProperty,
  readAssertionUses,
  type AssertionShape,
  type PoolDefinition,
  type PoolDiagnostic,
  type PoolReference,
} from '../../definitionPool';
import { goda } from '../definition';

const dialect = goda as AnyDialect;
const isAssertion = isAssertionProperty(dialect);

/** What a use says of its variable's type. */
const usedAs = (shape: AssertionShape) =>
  shape === 'bare' || shape === 'eqBool' ? 'boolean' : 'number';

export const godaPool = definePool({
  engine: 'goda',
  providers: [
    createModelProvider({
      dialect,
      kinds: { variable: { label: 'Context variable' } },
      field: (node, key) =>
        isAssertion(node, key)
          ? (text, { at, state }) => {
              const declared = (state.get('declared') ??
                new Set<string>()) as Set<string>;
              state.set('declared', declared);
              const definitions: PoolDefinition[] = [];
              const references: PoolReference[] = [];
              for (const use of readAssertionUses(text)) {
                const location = at(use.from, use.to);
                if (declared.has(use.name))
                  references.push({
                    kinds: ['gm.variable'],
                    name: use.name,
                    location,
                  });
                else {
                  declared.add(use.name);
                  definitions.push({
                    id: `gm.variable:${use.name}`,
                    kind: 'gm.variable',
                    name: use.name,
                    location,
                    detail: 'declared by its first use',
                  });
                }
              }
              return { definitions, references };
            }
          : undefined,
    }),
  ],
  checks: (pool): PoolDiagnostic[] => {
    const uses = assertionUsesIn(pool, isAssertion);
    const types = new Map<string, Set<string>>();
    for (const use of uses)
      types.set(
        use.name,
        (types.get(use.name) ?? new Set()).add(usedAs(use.shape)),
      );
    return uses
      .filter((use) => types.get(use.name)!.size > 1)
      .map((use) => ({
        ...use.location,
        severity: 'error',
        check: 'assertion-type-conflict',
        message: `${use.name} is used both as a boolean and as a number`,
      }));
  },
});

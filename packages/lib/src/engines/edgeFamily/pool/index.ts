/**
 * The Edge engines' definition pool (edge and edgeV2): the goal model, whose
 * conditions use variables and resources, and `variables.json`, which
 * declares the variables and their types; and #58's type checks of every
 * condition against them. A resource is the type it declares
 * (`{int 0..5 = 3}`), a boolean without one.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import {
  assertionTypeProblems,
  assertionUsesIn,
  createModelProvider,
  definePool,
  isAssertionProperty,
  readAssertionUses,
  type AssertionType,
  type PoolLookup,
  type PoolRegistration,
} from '../../definitionPool';
import { edge } from '../../edge/definition';
import { edgeV2 } from '../../edgeV2/definition';
import { variablesProvider } from './variables';

export * from './variables';

/** The type a declaration writes (`bool`, `int`), as conditions read it. */
const declaredType = (type: string | undefined): AssertionType | undefined =>
  type === 'bool' || type === 'boolean'
    ? 'boolean'
    : type === 'int' || type === 'number'
      ? type
      : undefined;

/** What a condition's name is, in the pool: a variable, or an element. */
const typeOfName = (
  pool: PoolLookup,
  name: string,
): AssertionType | undefined => {
  const variable = pool.find(['edge.variable'], name);
  if (variable) return declaredType(variable.type);
  const element = pool.find(['gm.resource', 'gm.goal', 'gm.task'], name);
  return element ? (declaredType(element.type) ?? 'boolean') : undefined;
};

const edgeFamilyPool = (
  engine: string,
  dialect: AnyDialect,
): PoolRegistration => {
  const isAssertion = isAssertionProperty(dialect);
  return definePool({
    engine,
    providers: [
      createModelProvider({
        dialect,
        refers: ['edge.variable'],
        element: (node) => {
          const type = declaredType(node.properties.type);
          return type ? { type } : undefined;
        },
        field: (node, key) =>
          isAssertion(node, key)
            ? (text, { at }) => ({
                definitions: [],
                // an unknown name is the goal language's to report
                references: readAssertionUses(text).map((use) => ({
                  kinds: ['edge.variable', 'gm.resource', 'gm.goal', 'gm.task'],
                  name: use.name,
                  location: at(use.from, use.to),
                  silent: true,
                })),
              })
            : undefined,
      }),
      variablesProvider,
    ],
    checks: (pool) =>
      pool.has('variables')
        ? assertionTypeProblems(
            assertionUsesIn(pool, isAssertion).map((use) => ({
              ...use,
              type: typeOfName(pool, use.name),
            })),
          )
        : [],
  });
};

export const edgePool = edgeFamilyPool('edge', edge as AnyDialect);
export const edgeV2Pool = edgeFamilyPool('edgeV2', edgeV2 as AnyDialect);

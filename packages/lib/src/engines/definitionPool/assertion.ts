/**
 * The variables an assertion value uses (the goal language's `assertion`
 * type, goal-controller#58), each where it is written and how it is used:
 * alone or negated (`x`, `!x`: a boolean), compared with true or false
 * (`x = true`), compared with a number by = or != (`x = 3`), or ordered
 * (`x > 0.5`). Read with the goal language's parser, so a dialect's prefix
 * (`assertion trigger …`) is read too.
 */
import {
  propertyOf,
  valueOf,
  type AnyDialect,
  type DocumentNode,
  type DocumentTree,
} from '@goal-controller/dialect';
import { goalServices, parseWith } from '@goal-controller/goal-language';
import { modelFieldDocument } from './model';
import type { PoolDiagnostic, PoolLocation, PoolLookup } from './types';

export type AssertionShape = 'bare' | 'eqBool' | 'eqNumber' | 'ordered';

export type AssertionUse = {
  name: string;
  /** offsets of the name in the value */
  from: number;
  to: number;
  shape: AssertionShape;
  /** the number it is compared with, when it is: `int` (`3`) or `decimal` (`0.5`) */
  literal?: 'int' | 'decimal';
};

/** Every AST node under a root. */
const nodes = (
  root: unknown,
  out: Record<string, unknown>[] = [],
): Record<string, unknown>[] => {
  if (root && typeof root === 'object') {
    const node = root as Record<string, unknown>;
    if (typeof node.$type === 'string') out.push(node);
    for (const [key, value] of Object.entries(node))
      if (!key.startsWith('$'))
        (Array.isArray(value) ? value : [value]).forEach((v) => nodes(v, out));
  }
  return out;
};

const shapeOf = (node: Record<string, unknown>): AssertionShape | null => {
  switch (node.$type) {
    case 'AssertVar':
      return 'bare';
    case 'AssertAssign':
      return 'eqBool';
    case 'AssertCompare':
      return node.operator === '=' || node.operator === '!='
        ? 'eqNumber'
        : 'ordered';
    default:
      return null;
  }
};

/** The variable uses of an assertion value, in the order written. */
export const readAssertionUses = (text: string): AssertionUse[] =>
  nodes(parseWith(goalServices(), 'assertion', text).value).flatMap(
    (node): AssertionUse[] => {
      const shape = shapeOf(node);
      const name = node.variable;
      const cst = node.$cstNode as { offset: number } | undefined;
      if (!shape || typeof name !== 'string' || !cst) return [];
      const literal =
        node.$type === 'AssertCompare' && typeof node.value === 'string'
          ? node.value.includes('.')
            ? ('decimal' as const)
            : ('int' as const)
          : undefined;
      return [
        {
          name,
          from: cst.offset,
          to: cst.offset + name.length,
          shape,
          ...(literal && { literal }),
        },
      ];
    },
  );

/** Whether an element's property is an assertion, in a dialect. */
export const isAssertionProperty =
  (dialect: Pick<AnyDialect, 'properties'>) =>
  (node: DocumentNode, key: string): boolean => {
    const property = propertyOf(dialect, node.kind, key);
    return (
      !!property && valueOf(property, node.properties).type === 'assertion'
    );
  };

/** A use where it is: its model field's document. */
export type LocatedUse = AssertionUse & { location: PoolLocation };

/** Every assertion's uses in the pool's goal model. */
export const assertionUsesIn = (
  pool: PoolLookup,
  isAssertion: (node: DocumentNode, key: string) => boolean,
): LocatedUse[] => {
  const tree = pool.documents.get('model')?.value as DocumentTree | undefined;
  return [...(tree?.nodes ?? [])].flatMap(([key, node]) =>
    Object.entries(node.properties).flatMap(([field, text]) =>
      isAssertion(node, field)
        ? readAssertionUses(text).map((use) => ({
            ...use,
            location: {
              document: modelFieldDocument(key, field),
              from: use.from,
              to: use.to,
            },
          }))
        : [],
    ),
  );
};

/** A variable's type, as an assertion reads it. */
export type AssertionType = 'boolean' | 'int' | 'number';

const numeric = (type: AssertionType) => type !== 'boolean';

/**
 * #58's type rules: an ordering on a boolean, = or != with the other type,
 * a bare variable or `!` on a number, an int compared with a decimal (a
 * warning). A use whose type is unknown (an unknown name) gets none.
 */
export const assertionTypeProblems = (
  uses: readonly (LocatedUse & { type: AssertionType | undefined })[],
): PoolDiagnostic[] =>
  uses.flatMap(({ name, shape, literal, location, type }): PoolDiagnostic[] => {
    if (!type) return [];
    const problem = (
      check: string,
      message: string,
      severity: PoolDiagnostic['severity'] = 'error',
    ): PoolDiagnostic[] => [{ ...location, severity, check, message }];
    if (shape === 'ordered' && !numeric(type))
      return problem(
        'assertion-order-on-boolean',
        `${name} is a boolean: compare it with = or !=`,
      );
    if (shape === 'eqBool' && numeric(type))
      return problem(
        'assertion-boolean-on-number',
        `${name} is a number (${type}): compare it with a number`,
      );
    if (shape === 'eqNumber' && !numeric(type))
      return problem(
        'assertion-number-on-boolean',
        `${name} is a boolean: compare it with true or false`,
      );
    if (shape === 'bare' && numeric(type))
      return problem(
        'assertion-needs-boolean',
        `${name} is a number (${type}): a condition needs a boolean`,
      );
    if (literal === 'decimal' && type === 'int')
      return problem(
        'assertion-int-with-decimal',
        `${name} is an int: compared with a decimal`,
        'warning',
      );
    return [];
  });

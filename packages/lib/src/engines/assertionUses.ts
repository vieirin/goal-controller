/**
 * How an assertion value (the goal language's `assertion` type, #58) uses
 * a name, read from the pool's reference to it: alone or negated (`x`,
 * `!x`: a boolean), compared with true or false (`x = true`), compared
 * with a number by = or != (`x = 3`), or ordered (`x > 0.5`). The Edge
 * engines and GODA check their variables' types with it.
 */
import type { ValueType } from '@goal-controller/dialect';

export type AssertionShape = 'bare' | 'eqBool' | 'eqNumber' | 'ordered';

/** A variable's type, as an assertion reads it: one of the goal language's value types. */
export type AssertionType = Extract<ValueType, 'bool' | 'int' | 'number'>;

const ASSERTION_TYPES: readonly AssertionType[] = ['bool', 'int', 'number'];

/** A definition's type, when it is one an assertion reads. */
export const assertionType = (
  type: string | undefined,
): AssertionType | undefined => ASSERTION_TYPES.find((t) => t === type);

/** where a name is: a definition or a reference of the pool's (`parent`: its AST node) */
type Located = { parent?: unknown };

export type AssertionUse<L extends Located = Located> = {
  /** the name used: a reference to its variable, or (first use) its definition */
  located: L;
  shape: AssertionShape;
  /** the number it is compared with, when it is: `int` (`3`) or `decimal` (`0.5`) */
  literal?: 'int' | 'decimal';
};

type Node = {
  $type?: string;
  $container?: Node;
  operator?: string;
  value?: string;
  right?: Node;
};

/** A name's use, if it is a variable of an assertion. */
export const assertionUse = <L extends Located>(
  located: L,
): AssertionUse<L> | null => {
  const node = located.parent as Node | undefined;
  switch (node?.$type) {
    case 'AssertVar':
      return { located, shape: 'bare' };
    case 'AssertAssign':
      return { located, shape: 'eqBool' };
    // a side of a comparison (`x > 3`: the name is an expression's)
    case 'ExprVar':
    case 'ExprRef': {
      const comparison = node.$container;
      if (comparison?.$type !== 'AssertCompare') return null;
      const number =
        comparison.right?.$type === 'ExprNumber'
          ? comparison.right.value
          : undefined;
      return {
        located,
        shape:
          comparison.operator === '=' || comparison.operator === '!='
            ? 'eqNumber'
            : 'ordered',
        literal: number?.includes('.') ? 'decimal' : 'int',
      };
    }
    default:
      return null;
  }
};

/** What a use says of its variable's type. */
export const usedAs = ({ shape }: AssertionUse): 'bool' | 'number' =>
  shape === 'bare' || shape === 'eqBool' ? 'bool' : 'number';

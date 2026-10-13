/**
 * How an assertion value (the goal language's `assertion` type, #58) uses
 * a name, read from the pool's reference to it: alone or negated (`x`,
 * `!x`: a boolean), compared with true or false (`x = true`), compared
 * with a number by = or != (`x = 3`), or ordered (`x > 0.5`). The Edge
 * engines and GODA check their variables' types with it.
 */
import type { ValueType } from '@goal-controller/dialect';
import type { Definition, Reference } from '../pool';

export type AssertionShape = 'bare' | 'eqBool' | 'eqNumber' | 'ordered';

/** A variable's type, as an assertion reads it: one of the goal language's value types. */
export type AssertionType = Extract<ValueType, 'bool' | 'int' | 'number'>;

const ASSERTION_TYPES: readonly AssertionType[] = ['bool', 'int', 'number'];

/** A definition's type, when it is one an assertion reads. */
export const assertionType = (
  type: string | undefined,
): AssertionType | undefined => ASSERTION_TYPES.find((t) => t === type);

export type AssertionUse = {
  /** the name used: a reference to its variable, or (first use) its definition */
  located: Definition | Reference;
  shape: AssertionShape;
  /** the number it is compared with, when it is: `int` (`3`) or `decimal` (`0.5`) */
  literal?: 'int' | 'decimal';
};

type Node = { $type?: string; operator?: string; value?: string };

/** A name's use, if it is a variable of an assertion. */
export const assertionUse = (
  located: Definition | Reference,
): AssertionUse | null => {
  const node = located.parent as Node | undefined;
  switch (node?.$type) {
    case 'AssertVar':
      return { located, shape: 'bare' };
    case 'AssertAssign':
      return { located, shape: 'eqBool' };
    case 'AssertCompare':
      return {
        located,
        shape:
          node.operator === '=' || node.operator === '!='
            ? 'eqNumber'
            : 'ordered',
        literal: node.value?.includes('.') ? 'decimal' : 'int',
      };
    default:
      return null;
  }
};

/** What a use says of its variable's type. */
export const usedAs = ({ shape }: AssertionUse): 'bool' | 'number' =>
  shape === 'bare' || shape === 'eqBool' ? 'bool' : 'number';

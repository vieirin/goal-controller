/**
 * `ltlTypeProblems` (../../src/ltl/index.ts, goal-controller#385): every
 * Problem kind a formula's predicate calls, attribute accesses and relation
 * memberships have against a `SymbolTable`, and the open world — a category
 * with no declared symbols is never checked.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  ltlTypeProblems,
  parseLtl,
  type SymbolTable,
} from '../../src/ltl/index.js';

const EMPTY: SymbolTable = {
  predicateArity: new Map(),
  attributesOf: new Map(),
  relations: new Set(),
};

const problemsOf = (text: string, symbols: SymbolTable): readonly string[] => {
  const { value, errors } = parseLtl(text);
  assert.deepStrictEqual(errors, [], text);
  return ltlTypeProblems(value!, symbols);
};

describe('ltlTypeProblems (#385)', () => {
  it('an unknown predicate', () => {
    const symbols: SymbolTable = {
      ...EMPTY,
      predicateArity: new Map([['high_water', 1]]),
    };
    assert.deepStrictEqual(problemsOf('loose(x)', symbols), [
      'loose is not a declared predicate',
    ]);
    assert.deepStrictEqual(problemsOf('high_water(s)', symbols), []);
  });

  it('a predicate called with the wrong arity', () => {
    const symbols: SymbolTable = {
      ...EMPTY,
      predicateArity: new Map([['high_water', 1]]),
    };
    assert.deepStrictEqual(problemsOf('high_water(s, t)', symbols), [
      'high_water takes 1 argument, not 2',
    ]);
  });

  it('an unknown attribute on a declared entity', () => {
    const symbols: SymbolTable = {
      ...EMPTY,
      attributesOf: new Map([['sump', new Set(['highWater', 'level'])]]),
    };
    assert.deepStrictEqual(problemsOf('sump.motor == true', symbols), [
      'sump has no attribute motor',
    ]);
    assert.deepStrictEqual(problemsOf('sump.highWater == true', symbols), []);
  });

  it('an unknown relation', () => {
    const symbols: SymbolTable = { ...EMPTY, relations: new Set(['has_pump']) };
    assert.deepStrictEqual(problemsOf('(sump, pump) in owns', symbols), [
      'owns is not a declared relation',
    ]);
    assert.deepStrictEqual(problemsOf('(sump, pump) in has_pump', symbols), []);
  });

  it('the open world: no symbols declared for a category, no Problem for it', () => {
    assert.deepStrictEqual(problemsOf('loose(x)', EMPTY), []);
    assert.deepStrictEqual(problemsOf('whatever.whatever == true', EMPTY), []);
    assert.deepStrictEqual(problemsOf('(a, b) in whatever', EMPTY), []);
  });

  it('walks nested formulas (forall, until, comparisons)', () => {
    const symbols: SymbolTable = {
      ...EMPTY,
      predicateArity: new Map([['ready', 0]]),
    };
    assert.deepStrictEqual(
      problemsOf('always (not ready() until loose())', symbols),
      ['loose is not a declared predicate'],
    );
  });
});

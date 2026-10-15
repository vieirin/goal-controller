/**
 * Propositional reasoning over assertion trees (goal-controller#152): its
 * atoms, satisfiability with a model or a minimal conflict, implication and
 * equivalence under assumptions, and comparisons kept opaque.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { readAssertion } from '@goal-controller/goal-language';
import { atomsOf, equivalent, implies, satisfiable } from '../../../src';

/** A formula's tree (`!` negates the operand it precedes). */
const f = (text: string) => {
  const tree = readAssertion(text);
  if (!tree) throw new Error(`not an assertion: ${text}`);
  return tree;
};

describe('propositional reasoning over assertions (#152)', () => {
  it('reads refs, variables, members and `x = true` as boolean atoms', () => {
    assert.deepStrictEqual(
      atomsOf(f('C1 & room.clean & (G2 | on = true) & off != true & G2')),
      ['C1', 'room.clean', 'G2', 'on', 'off'],
    );
    // `= false` and `!= true` are the atom negated
    assert.deepStrictEqual(satisfiable(f('on = false & off != true')), {
      satisfiable: true,
      model: { on: false, off: false },
      opaque: [],
    });
    assert.strictEqual(satisfiable(f('on = false & on')).satisfiable, false);
    assert.strictEqual(
      equivalent(f('room.clean = true'), f('room.clean')).holds,
      true,
    );
  });

  it('gives a model, its atoms false unless they must hold', () => {
    assert.deepStrictEqual(satisfiable(f('(a | b) & (c | !a)')), {
      satisfiable: true,
      model: { a: false, b: true, c: false },
      opaque: [],
    });
    assert.deepStrictEqual(satisfiable(f('true')), {
      satisfiable: true,
      model: {},
      opaque: [],
    });
    assert.strictEqual(satisfiable(f('false')).satisfiable, false);
  });

  it('gives a minimal set of the assumptions an unsatisfiable formula conflicts with', () => {
    // {b, c, !(b & c)} and {!a, c, !(b & c)} both conflict with a | b: the
    // first assumption that can go, goes
    const assumptions = [f('b'), f('!a'), f('c'), f('!(b & c)')];
    assert.deepStrictEqual(satisfiable(f('a | b'), assumptions), {
      satisfiable: false,
      conflict: [1, 2, 3],
      opaque: [],
    });
    assert.deepStrictEqual(satisfiable(f('a'), [f('b'), f('!a')]), {
      satisfiable: false,
      conflict: [1],
      opaque: [],
    });
    // unsatisfiable on its own: no assumption is to blame
    assert.deepStrictEqual(satisfiable(f('a & !a'), [f('b')]), {
      satisfiable: false,
      conflict: [],
      opaque: [],
    });
  });

  it('decides implication and equivalence under assumptions, with a counterexample', () => {
    assert.strictEqual(implies(f('a & b'), f('a')).holds, true);
    assert.deepStrictEqual(implies(f('a'), f('b')), {
      holds: false,
      counterexample: { a: true, b: false },
      opaque: [],
    });
    // under a → b, a implies b
    assert.strictEqual(implies(f('a'), f('b'), [f('!a | b')]).holds, true);
    assert.strictEqual(equivalent(f('!(a | b)'), f('!a & !b')).holds, true);
    assert.deepStrictEqual(equivalent(f('a | b'), f('a')), {
      holds: false,
      counterexample: { a: false, b: true },
      opaque: [],
    });
    // contradictory assumptions: everything follows
    assert.strictEqual(implies(f('a'), f('b'), [f('c'), f('!c')]).holds, true);
  });

  it('keeps a comparison or a call opaque, and says so', () => {
    // x > 3 and x < 2 can't both hold, but without arithmetic they can
    assert.deepStrictEqual(satisfiable(f('x > 3 & x < 2')), {
      satisfiable: true,
      model: { 'x > 3': true, 'x < 2': true },
      opaque: ['x > 3', 'x < 2'],
    });
    // the same comparison is the same atom: unsatisfiable stays sound
    assert.deepStrictEqual(satisfiable(f('x > 3 & !(x > 3)')), {
      satisfiable: false,
      conflict: [],
      opaque: ['x > 3'],
    });
    assert.deepStrictEqual(atomsOf(f('previous(on) & on')), [
      'previous(on)',
      'on',
    ]);
  });

  it('decides a formula over many atoms', () => {
    // a chain a0 → a1 → … → a39, and a0: a39 follows
    const chain = Array.from({ length: 39 }, (_, i) => f(`!a${i} | a${i + 1}`));
    assert.strictEqual(implies(f('a0'), f('a39'), chain).holds, true);
    assert.strictEqual(implies(f('a1'), f('a0'), chain).holds, false);
  });
});

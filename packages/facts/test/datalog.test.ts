import * as assert from 'assert';
import { describe, it } from 'mocha';
import { Program } from '../src/datalog/evaluate';
import { DatalogSyntaxError } from '../src/datalog/syntax';

const facts = (rows: Record<string, (string | number)[][]>) =>
  Object.entries(rows).flatMap(([relation, tuples]) =>
    tuples.map((tuple) => [relation, tuple] as const),
  );

const sorted = (tuples: readonly (readonly (string | number)[])[]) =>
  tuples.map((t) => t.join(' ')).sort();

describe('Datalog', () => {
  it('joins, and closes a recursive rule (semi-naive)', () => {
    const program = new Program(`
      path(X, Y) :- edge(X, Y).
      path(X, Z) :- path(X, Y), edge(Y, Z).
    `);
    const db = program.run(
      facts({
        edge: [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'd'],
        ],
      }),
    );
    assert.deepStrictEqual(sorted(db.query('path')), [
      'a b',
      'a c',
      'a d',
      'b c',
      'b d',
      'c d',
    ]);
  });

  it('negates a relation once it is complete (stratified)', () => {
    const program = new Program(`
      resolves(R, S) :- refers(R, N), defines(S, N).
      unresolved(R) :- refers(R, _), !resolves(R, _).
    `);
    const db = program.run(
      facts({
        refers: [
          ['r1', 'x'],
          ['r2', 'y'],
        ],
        defines: [['s1', 'x']],
      }),
    );
    assert.deepStrictEqual(sorted(db.query('unresolved')), ['r2']);
  });

  it('compares, binds with =, and reads constants and facts in the rules', () => {
    const program = new Program(`
      kind(number).
      earlier(A, B) :- at(A, I), at(B, J), I < J.
      typed(X, T) :- name(X), T = number, kind(T).
    `);
    const db = program.run(
      facts({
        at: [
          ['a', 1],
          ['b', 2],
        ],
        name: [['n']],
      }),
    );
    assert.deepStrictEqual(sorted(db.query('earlier')), ['a b']);
    assert.deepStrictEqual(sorted(db.query('typed')), ['n number']);
  });

  it('a repeated variable in an atom matches equal columns only', () => {
    const db = new Program('self(X) :- edge(X, X).').run(
      facts({
        edge: [
          ['a', 'a'],
          ['a', 'b'],
        ],
      }),
    );
    assert.deepStrictEqual(sorted(db.query('self')), ['a']);
  });

  it('rejects a negation inside recursion, and an unsafe rule', () => {
    assert.throws(
      () => new Program('p(X) :- q(X), !p(X).'),
      DatalogSyntaxError,
    );
    assert.throws(() => new Program('p(X, Y) :- q(X).'), DatalogSyntaxError);
  });
});

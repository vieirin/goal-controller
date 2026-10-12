/**
 * A file kind plugged in with no change to the core: a toy `.menu` format
 * (`dish name` defines; `order name` refers), and a second engine sharing it.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { definePool, FactPool, PoolDefinitionError } from '../src/core/pool';
import type { PoolFacts, PoolProvider } from '../src/core/types';

const LINE = /^(dish|order)\s+(\S+)/gm;

const menu: PoolProvider = {
  id: 'menu',
  documents: { extensions: ['.menu'] },
  kinds: { dish: { label: 'dish' } },
  refers: ['menu.dish'],
  extract: ({ id, text = '' }): PoolFacts => {
    const facts: PoolFacts = { definitions: [], references: [] };
    for (const match of text.matchAll(LINE)) {
      const from = match.index! + match[1]!.length + 1;
      const location = { document: id, from, to: from + match[2]!.length };
      if (match[1] === 'dish')
        facts.definitions.push({
          id: `menu.dish:${match[2]}`,
          kind: 'menu.dish',
          name: match[2]!,
          location,
        });
      else
        facts.references.push({
          kinds: ['menu.dish'],
          name: match[2]!,
          location,
        });
    }
    return facts;
  },
  rules: `
    menu.ordered(S) :- resolves(_, S), defines(S, 'menu.dish', _).
    problem(S, warning, 'menu.neverOrdered', '') :- defines(S, 'menu.dish', _), !menu.ordered(S).
  `,
  messages: { 'menu.neverOrdered': 'Nobody orders {name}' },
};

const docs = (a: string, b: string) => [
  { id: 'a.menu', kind: 'file', text: a },
  { id: 'b.menu', kind: 'file', text: b },
];

describe('a provider plugged in', () => {
  const pool = new FactPool(definePool('toy', [menu]));
  pool.update(docs('dish soup\ndish cake\n', 'order soup\norder pie\n'));

  it('gets diagnostics: its rules and the core’s', () => {
    assert.deepStrictEqual(
      pool
        .diagnostics()
        .map((d) => `${d.location.document} ${d.severity} ${d.message}`)
        .sort(),
      ['a.menu warning Nobody orders cake', 'b.menu error No dish named `pie`'],
    );
  });

  it('gets go-to-definition and references across files', () => {
    assert.deepStrictEqual(pool.definitionAt('b.menu', 7), [
      { document: 'a.menu', from: 5, to: 9 },
    ]);
    assert.deepStrictEqual(
      pool.referencesAt('a.menu', 6).map((l) => l.document),
      ['a.menu', 'b.menu'],
    );
  });

  it('renames across files, and refuses a name its kind already has', () => {
    assert.deepStrictEqual(pool.renameAt('b.menu', 7, 'broth'), {
      edits: [
        { document: 'a.menu', from: 5, to: 9, text: 'broth' },
        { document: 'b.menu', from: 6, to: 10, text: 'broth' },
      ],
    });
    assert.ok('refused' in pool.renameAt('a.menu', 6, 'cake'));
  });

  it('re-extracts only the changed file, and cuts off when only locations move', () => {
    const before = { ...pool.stats };
    pool.update(docs('dish soup\ndish cake\n', '\n\norder soup\norder pie\n'));
    assert.strictEqual(pool.stats.extracted - before.extracted, 1);
    assert.strictEqual(pool.stats.cutOffs - before.cutOffs, 1);
    pool.diagnostics();
    assert.strictEqual(pool.stats.evaluations, before.evaluations);
    assert.deepStrictEqual(pool.definitionAt('b.menu', 9), [
      { document: 'a.menu', from: 5, to: 9 },
    ]);
    pool.update(
      docs('dish soup\ndish cake\ndish pie\n', '\n\norder soup\norder pie\n'),
    );
    pool.diagnostics();
    assert.strictEqual(pool.stats.evaluations, before.evaluations + 1);
  });

  it('is shared by two engines, and namespaces are enforced', () => {
    assert.doesNotThrow(() => definePool('other', [menu]));
    assert.throws(() => definePool('twice', [menu, menu]), PoolDefinitionError);
    assert.throws(
      () =>
        definePool('rogue', [
          { ...menu, rules: 'hddl.task(X) :- defines(X, _, _).' },
        ]),
      PoolDefinitionError,
    );
  });
});

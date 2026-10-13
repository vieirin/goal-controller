/**
 * The pool's protocol (#82), first acceptance: a toy dialect with one JSON
 * file and one Langium model gets diagnostics, go-to-definition, references
 * and rename from its declaration alone (./toy/engine.ts), with no change
 * to the core.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  completionsAt,
  createPool,
  definitionAt,
  hoverAt,
  referencesAt,
  renameEdits,
  type PoolDocument,
} from '../../src/engines/definitionPool';
import { defineEngine, poolOf } from '../../src/pool';
import { toy } from './toy/engine';

const SHELVES = `{
  "shelves": [
    { "name": "top", "holds": [{ "thing": "ball", "part": "red" }, { "thing": "kite" }] },
    { "name": "bottom", "holds": [] }
  ]
}`;
const THINGS = `thing ball { part red part blue }
put ball.red on top
put ball on attic
`;

const documents = (shelves = SHELVES, things = THINGS): PoolDocument[] => [
  { id: 'shelves.json', kind: 'shelves', text: shelves },
  { id: 'a.toy', kind: 'file', text: things },
];

/** the offset of the nth `word` in a text */
const at = (text: string, word: string, nth = 0) => {
  let from = -1;
  for (let i = 0; i <= nth; i += 1) from = text.indexOf(word, from + 1);
  if (from < 0) throw new Error(`no ${word} #${nth}`);
  return from;
};
const span = (document: string, text: string, word: string, nth = 0) => ({
  document,
  from: at(text, word, nth),
  to: at(text, word, nth) + word.length,
});

/** the toy, with a check of its own: a shelf nothing is put on */
const toyChecked = defineEngine({
  ...toy,
  checks: [
    (pool) =>
      pool
        .definitions('toy.shelf')
        .filter((shelf) => !pool.referencesTo(shelf).length)
        .map((shelf) =>
          shelf.problem('warning', 'toy.emptyShelf', { name: shelf.name }),
        ),
  ],
  messages: { 'toy.emptyShelf': 'Nothing is put on {name}' },
});

describe('the pool, from a declared toy engine', () => {
  const index = () => createPool(poolOf(toyChecked)).update(documents());

  it('is declared in under 40 lines', () => {
    // past its imports, the lines that aren't blank or comments
    const source = readFileSync(join(__dirname, 'toy/engine.ts'), 'utf8');
    const lines = source
      .slice(source.indexOf('\nconst '))
      .split('\n')
      .filter((line) => line.trim() && !/^\s*(\/?\*|\/\/)/.test(line));
    expect(lines.length).to.be.below(40);
  });

  it('reports what resolves to nothing, what nothing uses, and its own check', () => {
    expect(
      index().diagnostics.map((d) => [d.check, d.document, d.message]),
    ).to.deep.equal([
      [
        'unresolved-reference',
        'shelves.json',
        'kite is no thing the project defines',
      ],
      [
        'unresolved-reference',
        'a.toy',
        'attic is no shelf the project defines',
      ],
      ['unused-definition', 'a.toy', 'blue is a part nothing refers to'],
      ['toy.emptyShelf', 'shelves.json', 'Nothing is put on bottom'],
    ]);
  });

  it('goes to a definition across the two files', () => {
    const pool = index();
    // the JSON's `ball` is the model's thing; the model's `top`, the JSON's shelf
    expect(
      definitionAt(pool, {
        document: 'shelves.json',
        offset: at(SHELVES, 'ball'),
      }),
    ).to.deep.equal(span('a.toy', THINGS, 'ball'));
    expect(
      definitionAt(pool, { document: 'a.toy', offset: at(THINGS, 'top') }),
    ).to.deep.equal(span('shelves.json', SHELVES, 'top'));
    // a part, in its thing (scope.owner, in the JSON and in the model)
    expect(
      definitionAt(pool, {
        document: 'shelves.json',
        offset: at(SHELVES, 'red'),
      }),
    ).to.deep.equal(span('a.toy', THINGS, 'red'));
    expect(
      definitionAt(pool, { document: 'a.toy', offset: at(THINGS, 'red', 1) }),
    ).to.deep.equal(span('a.toy', THINGS, 'red'));
  });

  it('finds the references, and renames them all', () => {
    const pool = index();
    const ball = { document: 'a.toy', offset: at(THINGS, 'ball') };
    expect(referencesAt(pool, ball)).to.deep.equal([
      span('a.toy', THINGS, 'ball'),
      span('shelves.json', SHELVES, 'ball'),
      span('a.toy', THINGS, 'ball', 1),
      span('a.toy', THINGS, 'ball', 2),
    ]);
    expect(renameEdits(pool, ball, 'bat')).to.deep.equal(
      referencesAt(pool, ball).map((location) => ({
        ...location,
        text: 'bat',
      })),
    );
  });

  it('hovers and completes by kind', () => {
    const pool = index();
    expect(
      hoverAt(pool, { document: 'shelves.json', offset: at(SHELVES, 'top') }),
    ).to.include({ label: 'shelf', references: 1 });
    expect(
      completionsAt(pool, {
        document: 'a.toy',
        offset: at(THINGS, 'attic'),
      }).map((c) => c.label),
    ).to.deep.equal(['top', 'bottom']);
    expect(
      completionsAt(pool, {
        document: 'shelves.json',
        offset: at(SHELVES, 'red'),
      }).map((c) => c.label),
    ).to.deep.equal(['red', 'blue']);
  });

  it('completes an empty name, and one being typed in a file that doesn’t parse yet', () => {
    const complete = (shelves: string) =>
      completionsAt(createPool(poolOf(toyChecked)).update(documents(shelves)), {
        document: 'shelves.json',
        offset: shelves.length,
      }).map((c) => c.label);
    const typing =
      '{ "shelves": [{ "name": "top", "holds": [{ "thing": "ball", "part": "';
    // an empty name being typed: its kinds and scope are known
    expect(complete(typing)).to.deep.equal(['red', 'blue']);
    // an empty name in valid JSON: the same, and it isn't said to be unresolved
    const pool = createPool(poolOf(toyChecked)).update(
      documents(`${typing}" }] }] }`),
    );
    expect(
      completionsAt(pool, {
        document: 'shelves.json',
        offset: typing.length,
      }).map((c) => c.label),
    ).to.deep.equal(['red', 'blue']);
    expect(
      pool.diagnostics.filter(
        (d) =>
          d.check === 'unresolved-reference' && d.document === 'shelves.json',
      ),
    ).to.deep.equal([]);
    // a name half typed, its string not closed
    expect(complete(`${typing}re`)).to.deep.equal(['red', 'blue']);
  });

  it('reports the files’ syntax and schema where they are', () => {
    const shelves = SHELVES.replace(
      '"holds": []',
      '"holds": 3, "colour": "red"',
    );
    const things = `${THINGS}put`;
    const pool = createPool(poolOf(toyChecked)).update(
      documents(shelves, things),
    );
    const said = pool.diagnostics
      .filter((d) => d.check === 'schema' || d.check === 'syntax')
      .map((d) => [
        d.check,
        d.document,
        shelves.slice(d.from, d.to) || things.slice(d.from, d.to),
      ]);
    expect(said.map(([check, document]) => [check, document])).to.deep.equal([
      ['schema', 'shelves.json'],
      ['schema', 'shelves.json'],
      ['syntax', 'a.toy'],
    ]);
    // the rest is still read: ball still resolves
    expect(
      definitionAt(pool, {
        document: 'shelves.json',
        offset: at(shelves, 'ball'),
      }),
    ).to.deep.equal(span('a.toy', things, 'ball'));
  });

  it('says nothing is unresolved when the file that defines it is absent', () => {
    // kite and ball aren't said; nothing is put on either shelf
    const pool = createPool(poolOf(toyChecked)).update([documents()[0]!]);
    expect(pool.diagnostics.map((d) => d.message)).to.deep.equal([
      'Nothing is put on top',
      'Nothing is put on bottom',
    ]);
  });
});

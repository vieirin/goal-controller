/**
 * The protocol typed by an engine's kinds and messages: a kind or a
 * message key that isn't the engine's doesn't compile (each
 * `@ts-expect-error` below fails the test run if its line compiles), and
 * nothing changes at run time.
 */
import { expect } from 'chai';
import * as z from 'zod/mini';
import { createPool } from '../../src/engines/definitionPool';
import {
  annotationsFor,
  defineEngine,
  defineFile,
  json,
  poolOf,
  type Check,
  type KindDeclaration,
} from '../../src/pool';

const KINDS = {
  'toy.shelf': { label: 'shelf' },
  'toy.thing': { label: 'thing' },
} as const satisfies Record<string, KindDeclaration>;
const MESSAGES = {
  'toy.noThing': '{name} is no thing on any shelf',
  'toy.emptyShelf': 'Nothing is put on {name}',
} as const;
type ToyKind = keyof typeof KINDS;
type ToyCheck = keyof typeof MESSAGES;

const { defines, refersTo } = annotationsFor(KINDS, MESSAGES);

const shelves = defineFile({
  kind: 'shelves',
  parser: json,
  schema: z.object({
    shelves: z.array(
      z.object({
        name: z.string().check(defines('toy.shelf')),
        holds: z.array(
          z.string().check(
            refersTo('toy.thing', undefined, {
              unresolved: { severity: 'error', message: 'toy.noThing' },
            }),
          ),
        ),
      }),
    ),
    things: z.array(z.string().check(defines('toy.thing'))),
  }),
});

const emptyShelf: Check<ToyKind, ToyCheck> = (pool) =>
  pool
    .definitions('toy.shelf')
    .filter(
      (shelf) =>
        !pool.references('toy.thing').some((r) => r.owner?.name === shelf.name),
    )
    .map((shelf) =>
      shelf.problem('warning', 'toy.emptyShelf', { name: shelf.name }),
    );

const toy = defineEngine({
  files: [shelves],
  kinds: KINDS,
  messages: MESSAGES,
  checks: [emptyShelf],
});

describe('the protocol, typed by an engine’s kinds and messages', () => {
  it('doesn’t compile a kind or a message key the engine doesn’t have', () => {
    const misspelt = () => [
      // @ts-expect-error: no such kind
      defines('toy.shelff'),
      // @ts-expect-error: no such kind, in a list
      refersTo(['toy.thing', 'toy.thinng']),
      refersTo('toy.thing', undefined, {
        // @ts-expect-error: no such message
        unresolved: { severity: 'error', message: 'toy.noThin' },
      }),
    ];
    const checks: Check<ToyKind, ToyCheck>[] = [
      (pool) =>
        pool
          // @ts-expect-error: no such kind
          .definitions('toy.shelve')
          .map(() => [])
          .flat(),
      (pool) =>
        pool
          .definitions('toy.shelf')
          // @ts-expect-error: no such message
          .map((shelf) => shelf.problem('error', 'toy.emptyShelve')),
    ];
    defineEngine({
      files: [shelves],
      kinds: {
        // @ts-expect-error: a type among kinds the engine doesn't declare
        'toy.thing': { label: 'thing', typeOf: { kinds: ['toy.shelve'] } },
        'toy.shelf': { label: 'shelf' },
      },
    });
    expect(misspelt).to.be.a('function');
    expect(checks).to.have.length(2);
  });

  it('reads and checks as the untyped protocol does', () => {
    const index = createPool(poolOf(toy)).update([
      {
        id: 'shelves.json',
        kind: 'shelves',
        text: '{ "shelves": [{ "name": "top", "holds": ["ball", "kite"] }, { "name": "low", "holds": [] }], "things": ["ball"] }',
      },
    ]);
    expect(
      index.diagnostics.map((d) => [d.check, d.severity, d.message]),
    ).to.deep.equal([
      ['toy.noThing', 'error', 'kite is no thing on any shelf'],
      ['toy.emptyShelf', 'warning', 'Nothing is put on low'],
    ]);
  });
});

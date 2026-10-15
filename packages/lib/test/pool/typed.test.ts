/**
 * The protocol typed by an engine's kinds and messages: a kind or a
 * message key that isn't the engine's doesn't compile (each
 * `@ts-expect-error` below fails the test run if its line compiles), and
 * nothing changes at run time.
 */
import { expect } from 'chai';
import type { LangiumCoreServices } from 'langium';
import * as z from 'zod/mini';
import { createPool } from '../../src/engines/definitionPool';
import type { ToyAstType } from './toy/generated/ast';
import { toyLanguage } from './toy/language';
import {
  annotationsFor,
  declarePool,
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
            refersTo('toy.thing', 'global', {
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

const toy = declarePool({
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
      refersTo(['toy.thing', 'toy.thinng'], 'global'),
      // @ts-expect-error: a scope is always said ('global' at least)
      refersTo('toy.thing'),
      // @ts-expect-error: nor left undefined
      refersTo('toy.thing', undefined),
      refersTo('toy.thing', 'global', {
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
    declarePool({
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

  it('types a Langium language by the AST types its services say they parse', () => {
    const { langium } = annotationsFor(KINDS, MESSAGES);
    const untyped: LangiumCoreServices = toyLanguage;
    const typed = () => [
      langium(toyLanguage, {
        start: 'Model',
        kinds: { Thing: 'toy.thing', Shelf: 'toy.shelf' },
        scopes: ['Thing'],
        annotate: {
          // the node is a Put: no cast
          Put: {
            part: (node) =>
              node.part ? [refersTo('toy.thing', 'global')] : [],
          },
        },
      }),
      langium(toyLanguage, {
        // @ts-expect-error: no such rule
        start: 'Modle',
      }),
      langium(toyLanguage, {
        // @ts-expect-error: no such kind
        kinds: { Thing: 'toy.thinng' },
      }),
      langium(toyLanguage, {
        // @ts-expect-error: no such AST type
        kinds: { Thingy: 'toy.thing' },
      }),
      langium(toyLanguage, {
        // @ts-expect-error: no such AST type
        scopes: ['Thingy'],
      }),
      langium(toyLanguage, {
        // @ts-expect-error: no such property of a Put
        annotate: { Put: { parts: [refersTo('toy.thing', 'global')] } },
      }),
      langium(toyLanguage, {
        annotate: {
          // @ts-expect-error: a Put has no name
          Put: { part: (node) => (node.name ? [] : []) },
        },
      }),
      // given explicitly, the same
      langium<ToyAstType>(untyped, { start: 'Model' }),
      langium<ToyAstType>(untyped, {
        // @ts-expect-error: no such rule
        start: 'Modle',
      }),
      // untyped services, as before: any name
      langium(untyped, { start: 'Anything', kinds: { Any: 'toy.thing' } }),
    ];
    expect(typed).to.be.a('function');
  });

  it('types what leads where by the engine’s leads, `type` built in', () => {
    const LEADS = ['holds'] as const;
    const typed = annotationsFor(KINDS, MESSAGES, LEADS);
    const misspelt = () => [
      typed.leadsTo('holds'),
      typed.scope.leadsTo('holds', 'name'),
      typed.scope.leadsTo('type', 'name'),
      // @ts-expect-error: no such lead
      typed.leadsTo('hold'),
      // @ts-expect-error: no such lead
      typed.scope.leadsTo('hold', 'name'),
    ];
    const check: Check<ToyKind, ToyCheck, (typeof LEADS)[number]> = (pool) =>
      pool
        .definitions('toy.shelf')
        // @ts-expect-error: no such lead
        .flatMap((shelf) => pool.leadsTo('hold', shelf))
        .map((thing) => thing.problem('warning', 'toy.noThing'));
    expect(misspelt).to.be.a('function');
    expect(check).to.be.a('function');
    // a file leading by a name the engine's leads don't declare
    const leading = defineFile({
      kind: 'leading',
      parser: json,
      schema: z.object({
        shelf: z.string().check(defines('toy.shelf')),
        thing: z
          .string()
          .check(refersTo('toy.thing', 'global'), typed.leadsTo('holds')),
      }),
    });
    expect(() =>
      poolOf(declarePool({ files: [leading], kinds: KINDS, leads: ['other'] })),
    ).to.throw(
      /leading leads by holds, which the engine's leads don't declare/,
    );
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

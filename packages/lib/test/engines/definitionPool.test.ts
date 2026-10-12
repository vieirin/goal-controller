/**
 * The definition pool's core (goal-controller#59): a provider plugs in with
 * no change to the core and gets every service; the HDDL provider is
 * registered without MutRoSe.
 */
import { expect } from 'chai';
import {
  completionsAt,
  createPool,
  definePool,
  definitionAt,
  hoverAt,
  referencesAt,
  renameEdits,
  type PoolDefinition,
  type PoolDocument,
  type PoolProvider,
  type PoolReference,
} from '../../src/engines/definitionPool';
import {
  createHddlProvider,
  hddlProvider,
} from '../../src/engines/definitionPool';

/**
 * A toy format: `thing NAME` defines a thing, `use NAME` uses one, `does
 * NAME` names an HDDL task (another provider's kind).
 */
let extracted = 0;
const toyProvider: PoolProvider = {
  id: 'toy',
  documents: { extensions: ['.toy'] },
  kinds: { thing: { label: 'Toy thing' } },
  refers: ['hddl.task'],
  extract: (document: PoolDocument) => {
    extracted += 1;
    const definitions: PoolDefinition[] = [];
    const references: PoolReference[] = [];
    for (const match of (document.text ?? '').matchAll(
      /^(thing|use|does) (\w+)$/gm,
    )) {
      const from = match.index + match[1]!.length + 1;
      const location = {
        document: document.id,
        from,
        to: from + match[2]!.length,
      };
      if (match[1] === 'thing')
        definitions.push({
          id: `toy.thing:${match[2]}`,
          kind: 'toy.thing',
          name: match[2]!,
          location,
        });
      else
        references.push({
          kinds: [match[1] === 'use' ? 'toy.thing' : 'hddl.task'],
          name: match[2]!,
          location,
        });
    }
    return { definitions, references };
  },
  checks: (pool) =>
    pool
      .references()
      .filter((r) => r.kinds.includes('toy.thing') && !pool.target(r))
      .map((r) => ({
        ...r.location,
        severity: 'error' as const,
        message: `No thing ${r.name}`,
        check: 'toy.unknown',
      })),
  complete: (pool, document, offset) =>
    /use \w*$/.test((document.text ?? '').slice(0, offset))
      ? pool.definitionsOf('toy.thing').map((d) => ({
          label: d.name,
          kind: d.kind,
          from: offset,
          to: offset,
        }))
      : [],
};

const DOMAIN = `(define (domain toys)
  (:types box - object)
  (:task pack :parameters (?b - box))
  (:method m-pack :parameters (?b - box)
    :task (pack ?b)
    :ordered-subtasks (and (seal ?b)))
  (:action seal :parameters (?b - box)))
`;
const TOY = 'thing ball\nuse ball\nuse kite\ndoes PACK\n';

const at = (text: string, word: string, nth = 0) => {
  let from = -1;
  for (let i = 0; i <= nth; i += 1) from = text.indexOf(word, from + 1);
  return from;
};

describe('the definition pool, with a provider plugged in', () => {
  const registration = definePool({
    engine: 'toys',
    providers: [toyProvider, hddlProvider],
  });

  it('indexes what each provider extracts, and resolves across them', () => {
    const index = createPool(registration).update([
      { id: 'a.toy', kind: 'file', text: TOY },
      { id: 'domain.hddl', kind: 'hddl', text: DOMAIN },
    ]);
    // `does PACK` is HDDL's task (its names compare lowercased)
    expect(
      definitionAt(index, { document: 'a.toy', offset: at(TOY, 'PACK') }),
    ).to.deep.equal({
      document: 'domain.hddl',
      from: at(DOMAIN, 'pack'),
      to: at(DOMAIN, 'pack') + 4,
    });
    expect(index.diagnostics.map((d) => d.message)).to.deep.equal([
      'No thing kite',
    ]);
  });

  it('serves references, rename, hover and completion with no change to the core', () => {
    const index = createPool(registration).update([
      { id: 'a.toy', kind: 'file', text: TOY },
      { id: 'domain.hddl', kind: 'hddl', text: DOMAIN },
    ]);
    const ball = { document: 'a.toy', offset: at(TOY, 'ball', 1) };
    expect(referencesAt(index, ball).map((l) => l.from)).to.deep.equal([
      at(TOY, 'ball'),
      at(TOY, 'ball', 1),
    ]);
    expect(renameEdits(index, ball, 'bat')).to.deep.equal([
      { document: 'a.toy', from: 6, to: 10, text: 'bat' },
      { document: 'a.toy', from: 15, to: 19, text: 'bat' },
    ]);
    expect(hoverAt(index, ball)).to.include({
      label: 'Toy thing',
      references: 1,
    });
    expect(
      completionsAt(index, {
        document: 'a.toy',
        offset: at(TOY, 'ball', 1),
      }).map((c) => c.label),
    ).to.deep.equal(['ball']);
    // HDDL's rename keeps a parameter's `?`: the method's, and its two uses
    const param = { document: 'domain.hddl', offset: at(DOMAIN, '?b', 1) + 1 };
    expect(
      (
        renameEdits(index, param, 'crate') as { from: number; text: string }[]
      ).map((e) => [e.from, e.text]),
    ).to.deep.equal([
      [at(DOMAIN, '?b', 1), '?crate'],
      [at(DOMAIN, '?b', 2), '?crate'],
      [at(DOMAIN, '?b', 3), '?crate'],
    ]);
  });

  it('reports what resolves to nothing, for every provider, unless a check says it already', () => {
    const index = createPool(registration).update([
      { id: 'a.toy', kind: 'file', text: `${TOY}does UNPACK\n` },
      { id: 'domain.hddl', kind: 'hddl', text: DOMAIN },
    ]);
    expect(
      index.diagnostics.map((d) => [
        d.check,
        TOY.length <= d.from ? 'UNPACK' : 'kite',
        d.message,
      ]),
    ).to.deep.equal([
      // the toy's own check says kite: not again
      ['toy.unknown', 'kite', 'No thing kite'],
      // no check says UNPACK: the pool does
      [
        'unresolved-reference',
        'UNPACK',
        'UNPACK is no HDDL task the project defines',
      ],
    ]);
  });

  it('re-extracts only the documents that changed', () => {
    const pool = createPool(registration);
    const hddl = { id: 'domain.hddl', kind: 'hddl', text: DOMAIN };
    pool.update([{ id: 'a.toy', kind: 'file', text: TOY }, hddl]);
    const before = extracted;
    const index = pool.update([
      { id: 'a.toy', kind: 'file', text: `${TOY}thing kite\n` },
      hddl,
    ]);
    expect(extracted - before).to.equal(1);
    expect(index.diagnostics).to.deep.equal([]);
  });

  it('holds providers to their namespaces and to what they refer to', () => {
    expect(() =>
      definePool({ engine: 'x', providers: [toyProvider, toyProvider] }),
    ).to.throw(/two providers are toy/);
    expect(() =>
      definePool({ engine: 'x', providers: [toyProvider] }),
    ).to.throw(/toy refers to hddl.task, which no provider defines/);
    const outside: PoolProvider = {
      ...toyProvider,
      id: 'rogue',
      refers: [],
      extract: (document) => ({
        definitions: [
          {
            id: 'toy.thing:x',
            kind: 'toy.thing',
            name: 'x',
            location: { document: document.id, from: 0, to: 1 },
          },
        ],
        references: [],
      }),
    };
    expect(() =>
      createPool(definePool({ engine: 'x', providers: [outside] })).update([
        { id: 'a.toy', kind: 'file', text: '' },
      ]),
    ).to.throw(/rogue defines toy.thing, outside its namespace/);
  });
});

describe('the HDDL provider, on its own', () => {
  const index = createPool(
    definePool({ engine: 'planner', providers: [hddlProvider] }),
  ).update([{ id: 'domain.hddl', kind: 'hddl', text: DOMAIN }]);

  it('defines types, tasks, methods, actions and their parameters, and resolves their uses', () => {
    expect(index.definitions.map((d) => `${d.kind} ${d.name}`)).to.deep.equal([
      'hddl.type box',
      'hddl.task pack',
      'hddl.param ?b',
      'hddl.method m-pack',
      'hddl.param ?b',
      'hddl.action seal',
      'hddl.param ?b',
    ]);
    expect(index.references().filter((r) => !index.target(r))).to.deep.equal(
      [],
    );
    // a method's ?b is its own, not its task's
    const methodParam = index.definitions.find(
      (d) => d.owner === 'hddl.method:m-pack',
    )!;
    expect(
      index.referencesTo(methodParam.id).map((r) => r.location.from),
    ).to.deep.equal([at(DOMAIN, '?b', 2), at(DOMAIN, '?b', 3)]);
  });

  it('declares a type by its use when asked to (MutRoSe’s domains use `robot` so)', () => {
    const text = '(define (domain d) (:task go :parameters (?r - robot)))';
    const strict = createPool(
      definePool({ engine: 'p', providers: [hddlProvider] }),
    ).update([{ id: 'd.hddl', kind: 'hddl', text }]);
    expect(strict.definitionsOf('hddl.type')).to.deep.equal([]);
    const lenient = createPool(
      definePool({
        engine: 'p',
        providers: [createHddlProvider({ typesDeclaredByUse: true })],
      }),
    ).update([{ id: 'd.hddl', kind: 'hddl', text }]);
    expect(lenient.definitionsOf('hddl.type').map((d) => d.name)).to.deep.equal(
      ['robot'],
    );
  });
});

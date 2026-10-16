/**
 * Links with an actor at an end (goal-controller#162): a toy lending
 * dialect (not STS) whose extension adds an actor-to-actor `trusts` link
 * (a set of terms, the goals it covers, whether it may be passed on), a
 * goal-to-actor `asks` link, and a goal-to-goal `hands` link between
 * elements of different actors. A link from an actor is written under its
 * `actor` line, a link to one names it `actor "Name"`; both read back,
 * validate, complete and hover as an element's link lines do.
 */
import {
  defineDialect,
  defineExtension,
  property,
  type AnyDialect,
  type DocumentActor,
  type DocumentLink,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  hoverAt,
  notationDocument,
  notationEdits,
  readLinkLine,
  takesPosition,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

const lending = defineExtension({
  name: 'lend',
  label: 'Lending',
  elements: [],
  links: [
    {
      kind: 'lend.Trusts',
      rules: { sources: ['actor'], targets: ['actor'], sameActor: false },
    },
    {
      kind: 'lend.Asks',
      rules: { sources: ['istar.Goal'], targets: ['actor'], sameActor: false },
    },
    {
      kind: 'lend.Hands',
      rules: {
        sources: ['istar.Goal'],
        targets: ['istar.Goal'],
        sameActor: false,
      },
    },
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

const TERMS = ['cash', 'goods', 'time'] as const;

const lend = defineDialect({
  ...(structuredClone(toy) as AnyDialect),
  id: 'lend',
  name: 'Lend',
  extension: lending,
  links: {
    'lend.Trusts': [
      property.enumSet('terms', TERMS, { help: 'what it lends' }),
      property.refList('covers', 'goal', { help: 'the goals it covers' }),
      property.bool('passOn', { help: 'whether it may be passed on' }),
    ],
    'lend.Asks': [property.int('amount', { min: 0, help: 'how much' })],
    'lend.Hands': [property.text('note', { help: 'why' })],
  },
});

const actor = (
  iStarId: string,
  name: string,
  elements: string[],
): DocumentActor => ({
  iStarId,
  kind: 'istar.Role',
  name,
  properties: {},
  elements,
});

/** a link as the view has it: an actor end's key null, its ends' piStar ids */
const link = (
  iStarId: string,
  kind: string,
  [source, sourceKey]: [string, string | null],
  [target, targetKey]: [string, string | null],
  properties: Record<string, string>,
): DocumentLink => ({
  iStarId,
  kind,
  source: sourceKey,
  target: targetKey,
  properties,
  ends: {
    source: { iStarId: source, kind: null },
    target: { iStarId: target, kind: null },
  },
});

const tree: DocumentTree = {
  nodes: new Map([
    ['G1', node({ id: 'G1', kind: 'goal', name: 'Borrow' })],
    ['G2', node({ id: 'G2', kind: 'goal', name: 'Lend' })],
  ]),
  roots: ['G1', 'G2'],
  actors: [
    actor('ann', 'Ann', ['G1']),
    actor('bank', 'Bank', ['G2']),
    actor('bank2', 'Bank', []),
  ],
  links: [
    link('t1', 'lend.Trusts', ['ann', null], ['bank', null], {
      terms: 'cash, time',
      covers: 'G1',
      passOn: 'false',
    }),
    link('t2', 'lend.Trusts', ['bank', null], ['bank2', null], {
      terms: 'goods',
    }),
    link('a1', 'lend.Asks', ['i-G1', 'G1'], ['bank', null], { amount: '5' }),
    link('h1', 'lend.Hands', ['i-G1', 'G1'], ['i-G2', 'G2'], { note: 'due' }),
    // a link without properties set has no line
    link('t3', 'lend.Trusts', ['bank2', null], ['ann', null], {}),
  ],
};

const context = contextFromView(lend, tree, []);
const DOC = notationDocument(lend, tree).text;
const messages = (doc: string) =>
  documentDiagnostics(lend, doc, context).map((d) => [
    doc.slice(d.from, d.to),
    d.message,
  ]);

describe('links with an actor at an end (#162)', () => {
  it('writes a link from an actor under its actor line, and one to an actor by its name', () => {
    expect(DOC).to.equal(
      [
        'actor "Ann"',
        '  link actor "Bank"#1 {terms = cash, time} {covers = G1} {passOn = false}',
        'actor "Bank"#1',
        '  link actor "Bank"#2 {terms = goods}',
        'G1: Borrow',
        '  link actor "Bank"#1 {amount = 5}',
        '  link G2 {note = due}',
        'G2: Lend',
      ].join('\n'),
    );
    expect(messages(DOC)).to.deep.equal([]);
    expect(notationEdits(lend, DOC, tree)).to.deep.equal([]);
  });

  it('reads a link line’s edits under an actor, and to an actor', () => {
    const edited = DOC.replace('{terms = cash, time}', '{terms = goods}')
      .replace('{amount = 5}', '{amount = 7}')
      .replace('  link actor "Bank"#2 {terms = goods}\n', '');
    // the elements' links first, then the actors'
    expect(notationEdits(lend, edited, tree)).to.deep.equal([
      { link: 'a1', key: 'amount', value: '7' },
      { link: 't1', key: 'terms', value: 'goods' },
      { link: 't2', key: 'terms', value: null },
    ]);
    // an actor line naming no actor (being typed) changes none of its links
    expect(
      notationEdits(lend, DOC.replace('actor "Ann"', 'actor "An"'), tree),
    ).to.deep.equal([]);
  });

  it('reports a target no actor has, a link that isn’t there, and other lines under an actor', () => {
    expect(
      messages(
        DOC.replace('link actor "Bank"#2', 'link actor "Bob"')
          .replace(
            '{amount = 5}',
            '{amount = 5}\n  link actor "Ann" {amount = 1}',
          )
          .replace('actor "Bank"#1\n', 'actor "Bank"#1\n  covers G1\n'),
      ),
    ).to.deep.equal([
      ['covers G1', 'Only link lines go under an actor line'],
      ['actor "Bob"', 'No actor "Bob"'],
      ['actor "Ann"', 'No link from G1 to actor "Ann" has properties in Lend'],
    ]);
    expect(
      messages(DOC.replace('{terms = goods}', '{terms = goods, goods}')),
    ).to.deep.equal([['goods, goods', 'goods is written twice']]);
    expect(readLinkLine('actor Bank {amount = 1}')).to.have.property('error');
  });

  it('completes an actor’s link targets and their keys, and hovers them', () => {
    const at = DOC.indexOf('link actor "Bank"#2') + 'link '.length;
    const typing = `${DOC.slice(0, at)}${DOC.slice(at + 'actor "Bank"#2'.length)}`;
    expect(
      completionsAt(lend, typing, at, context)?.options.map((o) => o.label),
    ).to.deep.equal(['actor "Bank"#2']);
    const under = DOC.indexOf('{amount = 5}');
    // the keys not written before it
    expect(
      completionsAt(
        lend,
        DOC,
        DOC.indexOf('{covers') + 1,
        context,
      )?.options.map((o) => o.label),
    ).to.deep.equal(['covers', 'passOn']);
    expect(
      completionsAt(lend, DOC, under + 1, context)?.options.map((o) => o.label),
    ).to.deep.equal(['amount']);
    expect(
      hoverAt(lend, DOC, DOC.indexOf('passOn') + 1, context)?.markdown,
    ).to.include('whether it may be passed on');
  });
});

describe('links with an actor at an end, in a dialect without ids (#162)', () => {
  const plain = defineDialect({
    ...(structuredClone(lend) as AnyDialect),
    id: 'plainLend',
    elements: { goal: { fill: '#FFF' }, task: { fill: '#FFF' } },
    properties: { goal: [], task: [] },
    propertyLineOrder: [],
    notation: undefined,
    linkLines: true,
  });
  const named = (id: string, name: string) =>
    node({ id, iStarId: id, kind: 'goal', name });
  const plainTree: DocumentTree = {
    ...tree,
    nodes: new Map([
      ['g1', named('g1', 'Borrow')],
      ['g2', named('g2', 'Lend')],
    ]),
    roots: ['g1', 'g2'],
    links: (tree.links ?? []).map((l) => ({
      ...l,
      source: l.source && l.source.replace('G', 'g'),
      target: l.target && l.target.replace('G', 'g'),
      // a refList names elements by id: none in a dialect without ids
      properties: Object.fromEntries(
        Object.entries(l.properties).filter(([key]) => key !== 'covers'),
      ),
    })),
  };
  const doc = notationDocument(plain, plainTree).text;

  it('writes and reads them back, no line taking an element’s place', () => {
    expect(doc).to.include('Borrow\n  link actor "Bank"#1 {amount = 5}');
    expect(takesPosition(plain, '  link actor "Bank" {amount = 5}')).to.equal(
      false,
    );
    expect(takesPosition(plain, 'actor "Bank"')).to.equal(false);
    expect(notationEdits(plain, doc, plainTree)).to.deep.equal([]);
    expect(
      notationEdits(
        plain,
        doc.replace('{amount = 5}', '{amount = 6}'),
        plainTree,
      ),
    ).to.deep.equal([{ link: 'a1', key: 'amount', value: '6' }]);
    expect(
      documentDiagnostics(plain, doc, contextFromView(plain, plainTree, [])),
    ).to.deep.equal([]);
  });
});

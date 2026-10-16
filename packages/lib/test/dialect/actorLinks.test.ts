/**
 * Links with an actor at an end, end to end (goal-controller#162): a piStar
 * file whose metamodel block adds an actor-to-actor link and a goal-to-goal
 * link between two actors (a toy lending dialect, not STS) is read by
 * istar-ts, viewed by goal-tree, written as the Notation text with the
 * actor's link line under its actor line, and edited back; checks and
 * analyses read the actor ends by their piStar ids.
 */
import { expect } from 'chai';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import {
  defineDialect,
  defineExtension,
  linkSpecsOfKind,
  property,
  type AnyDialect,
} from '@goal-controller/dialect';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { pistarAnalysisModel } from '../../src';
import { toy } from '../../../dialect/test/support/toy';

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

const lend = defineDialect({
  ...(structuredClone(toy) as AnyDialect),
  id: 'lend',
  name: 'Lend',
  extension: lending,
  links: {
    'lend.Trusts': [
      property.enumSet('terms', ['cash', 'goods'], { help: 'what it lends' }),
      property.refList('covers', 'goal', { help: 'the goals it covers' }),
    ],
    'lend.Hands': [property.text('note', { help: 'why' })],
  },
});

const node = (id: string, type: string, text: string) => ({
  id,
  text,
  type,
  x: 0,
  y: 0,
  customProperties: {},
});

const FILE = {
  actors: [
    {
      ...node('ann', 'istar.Role', 'Ann'),
      nodes: [node('g1', 'istar.Goal', 'G1: Borrow')],
    },
    {
      ...node('bank', 'istar.Agent', 'Bank'),
      nodes: [node('g2', 'istar.Goal', 'G2: Borrow')],
    },
  ],
  orphans: [],
  dependencies: [],
  links: [
    {
      id: 't1',
      type: 'lend.Trusts',
      source: 'ann',
      target: 'bank',
      customProperties: { terms: 'cash, goods', covers: 'G1' },
    },
    {
      id: 'h1',
      type: 'lend.Hands',
      source: 'g1',
      target: 'g2',
      customProperties: { note: 'due' },
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  diagram: { width: 400, height: 200, name: 'Lend', customProperties: {} },
  metamodel: {
    name: 'lend',
    elements: [],
    links: lending.links.map(({ kind, rules }) => ({ kind, rules })),
  },
};

const model = parsePistar(JSON.stringify(FILE), { fileMetamodel: true });
const view = goalView(model, lend);

describe('links with an actor at an end, from a piStar file (#162)', () => {
  it('keeps both kinds of link, an actor’s ends by their piStar ids', () => {
    const trusts = view.links.find((l) => l.iStarId === 't1')!;
    expect([trusts.source, trusts.target]).to.deep.equal([null, null]);
    expect(trusts.ends.source.iStarId).to.equal('ann');
    expect(trusts.ends.target.iStarId).to.equal('bank');
    const hands = view.links.find((l) => l.iStarId === 'h1')!;
    expect([hands.source, hands.target]).to.deep.equal(['G1', 'G2']);
  });

  it('writes the actor’s link under its actor line, the goals’ under G1, and reads them back', () => {
    const doc = notationDocument(lend, view).text;
    expect(doc).to.equal(
      [
        'actor "Ann"',
        '  link actor "Bank" {terms = cash, goods} {covers = G1}',
        'G2: Borrow',
        'G1: Borrow',
        '  link G2 {note = due}',
      ].join('\n'),
    );
    const context = contextFromView(lend, view, []);
    expect(documentDiagnostics(lend, doc, context)).to.deep.equal([]);
    expect(
      notationEdits(lend, doc.replace('cash, goods', 'goods'), view),
    ).to.deep.equal([{ link: 't1', key: 'terms', value: 'goods' }]);
  });

  it('gives checks, analyses and the inspector the actor link as any other', () => {
    const check = checkContextOf(contextFromView(lend, view, []), 't1');
    expect(check.readLink?.('t1')?.ends?.source.iStarId).to.equal('ann');
    expect(check.readActor?.('bank')?.kind).to.equal('istar.Agent');
    const link = pistarAnalysisModel(FILE).links[0]!;
    expect([link.kind, link.source, link.target]).to.deep.equal([
      'lend.Trusts',
      'ann',
      'bank',
    ]);
    expect(
      linkSpecsOfKind(lend, {}, 'lend.Trusts').map((spec) => [
        spec.key,
        typeof spec.input === 'function' ? 'conditional' : spec.input.kind,
      ]),
    ).to.deep.equal([
      ['terms', 'multiSelect'],
      ['covers', 'text'],
    ]);
  });
});

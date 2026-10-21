/**
 * Keyed properties and their targets (goal-controller#354, #345): the
 * grammar reads `Rate[e1]` (its PropertyKey), the Notation view writes and
 * reads a keyed property's lines under its own, a name that resolves to
 * nothing is the dangling-name problem a `reference` has, completion offers
 * a target's names after `[`, and readProperties types each name by what it
 * names.
 */
import {
  defineDialect,
  targetId,
  type DefinitionContext,
  type ElementId,
  type ResourceId,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  documentDiagnostics,
  keyedKeyOf,
  notationDocument,
  notationEdits,
  propertyOf,
  readLine,
  readProperties,
  valueProblem,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const rated = defineDialect({
  ...toy,
  projectResources: {
    expert: {
      label: 'Experts',
      format: 'json',
      path: 'experts.json',
      entries: true,
    },
  },
  properties: {
    ...toy.properties,
    goal: [
      ...toy.properties.goal,
      {
        key: 'Rate',
        value: { type: 'probability' },
        keyed: { resource: 'expert' },
        help: 'how likely, per expert',
      },
      {
        key: 'Owner',
        value: { type: 'reference', target: { kinds: ['task'] } },
        help: 'the task that owns it',
      },
      {
        key: 'Note',
        value: { type: 'text' },
        keyed: { written: true },
        help: 'a note, by its name',
      },
    ],
  },
  propertyLineOrder: [...toy.propertyLineOrder, 'Rate', 'Owner', 'Note'],
});

const experts = [
  { id: targetId({ resource: 'expert' }, 'e1'), name: 'Expert 1' },
  { id: targetId({ resource: 'expert' }, 'e2'), name: 'Expert 2' },
];

const context: DefinitionContext = {
  elements: {
    G1: {
      kind: 'goal',
      children: ['T1'],
      properties: { 'Note[why]': 'it matters' },
    },
    T1: { kind: 'task', children: [], properties: {} },
  },
  variables: [],
  projectResources: { expert: { symbols: {}, entries: experts } },
};

describe('keyed keys, read by the grammar (#354)', () => {
  it('reads a key and the name in its brackets, and nothing else', () => {
    expect(keyedKeyOf('Rate[e1]')).to.deep.equal({ key: 'Rate', name: 'e1' });
    expect(keyedKeyOf('Objective[8MinRespRate]')).to.deep.equal({
      key: 'Objective',
      name: '8MinRespRate',
    });
    expect(keyedKeyOf('Weight[G1.2]')).to.deep.equal({
      key: 'Weight',
      name: 'G1.2',
    });
    for (const text of ['Rate', 'Rate[e1', 'Rate[]', 'Rate[e 1]', 'Rate[e1]x'])
      expect(keyedKeyOf(text), text).to.equal(null);
  });

  it('reads a keyed property line: its key as stored, and its name’s span', () => {
    const read = readLine(rated, '  Rate[e1] 20%');
    expect(read).to.deep.include({
      kind: 'property',
      key: 'Rate[e1]',
      value: '20%',
      keyed: { key: 'Rate', name: 'e1', nameSpan: { from: 7, to: 9 } },
    });
    expect(readLine(rated, '  Rate 20%')).to.not.have.property('keyed');
    expect(readLine(rated, '  Rate[e1 20%').errors).to.not.deep.equal([]);
  });

  it('finds the property of a keyed key, only where it is keyed', () => {
    expect(propertyOf(rated, 'goal', 'Rate[e1]')?.key).to.equal('Rate');
    expect(propertyOf(rated, 'goal', 'Owner[e1]')).to.equal(undefined);
  });
});

describe('keyed lines in the Notation view (#345)', () => {
  const tree = {
    roots: ['G1'],
    nodes: new Map([
      [
        'G1',
        node({
          id: 'G1',
          kind: 'goal',
          name: 'Go',
          properties: {
            Rate: '10%',
            'Rate[e1]': '20%',
            'Rate[e2]': '30%',
            Owner: 'T1',
          },
        }),
      ],
    ]),
  };

  it('writes a keyed property’s lines under its own, in the order stored', () => {
    expect(notationDocument(rated, tree).text).to.equal(
      'G1: Go\n  Rate 10%\n  Rate[e1] 20%\n  Rate[e2] 30%\n  Owner T1',
    );
  });

  it('reads them back: unchanged, a value changed, a name added or removed', () => {
    const { text } = notationDocument(rated, tree);
    expect(notationEdits(rated, text, tree)).to.deep.equal([]);
    const edited = text
      .replace('Rate[e1] 20%', 'Rate[e1] 25%')
      .replace('  Rate[e2] 30%\n', '')
      .concat('\n  Note[why] it matters');
    expect(notationEdits(rated, edited, tree)).to.deep.equal([
      { iStarId: 'i-G1', key: 'Rate[e1]', value: '25%' },
      { iStarId: 'i-G1', key: 'Rate[e2]', value: null },
      { iStarId: 'i-G1', key: 'Note[why]', value: 'it matters' },
    ]);
  });

  it('reports a name its target doesn’t have as a reference’s dangling name', () => {
    const doc = 'G1: Go [T1]\n  Rate[e9] 20%\n  Owner T9\n  Note[any] ok';
    expect(
      documentDiagnostics(rated, doc, context).map((d) => [d.key, d.message]),
    ).to.deep.equal([
      ['Rate[e9]', "e9 is not one of the project's experts"],
      ['Owner', 'T9 is not an element of this model'],
    ]);
    // the resources not read: nothing to say of an expert
    expect(
      documentDiagnostics(rated, doc, { ...context, projectResources: {} }).map(
        (d) => d.key,
      ),
    ).to.deep.equal(['Owner']);
    expect(
      valueProblem(
        { type: 'reference', target: { resource: 'expert' } },
        'e3',
        context,
        rated,
      ),
    ).to.equal("e3 is not one of the project's experts");
  });

  it('completes a target’s names after `[`', () => {
    const labels = (doc: string) =>
      completionsAt(rated, doc, doc.length, context)?.options.map((o) => [
        o.label,
        o.detail,
      ]);
    expect(labels('G1: Go [T1]\n  Rate[')).to.deep.equal([
      ['e1', 'Expert 1'],
      ['e2', 'Expert 2'],
    ]);
    expect(labels('G1: Go [T1]\n  Note[w')).to.deep.equal([
      ['why', 'written under Note'],
    ]);
    expect(labels('G1: Go [T1]\n  Owner ')).to.deep.equal([['T1', 'task']]);
  });
});

describe('a keyed property read, typed by its target (#354)', () => {
  it('reads each name’s value by its brand, in the order written', () => {
    const record = readProperties(
      rated,
      { element: 'goal' },
      { Rate: '10%', 'Rate[e1]': '20%', 'Rate[e2]': 'none', Owner: 'T1' },
    );
    const rates = record.keyed.Rate!;
    expect([...rates]).to.deep.equal([['e1', 0.2]]);
    expect(record.keyed.Note && [...record.keyed.Note]).to.deep.equal([]);
    const typed: [
      Same<typeof rates, ReadonlyMap<ResourceId<'expert'>, number | null>>,
      Same<typeof record.values.Owner, ElementId<'task'> | null | undefined>,
    ] = [true, true];
    expect(typed).to.deep.equal([true, true]);
  });
});

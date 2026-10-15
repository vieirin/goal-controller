/**
 * A link's properties in the goal language (goal-controller#107): the `link`
 * property line under the link's source, read, written, mapped back to the
 * link, and checked (src/notation/linkLine.ts).
 */
import {
  defineDialect,
  type DefinitionContext,
  type DocumentLink,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  hasLinkLine,
  linkLine,
  notationDocument,
  notationEdits,
  readLinkLine,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

/** The toy, with a weight on contributions and a kind on Feeds links, and a budget on actors. */
const linked = defineDialect({
  ...toy,
  id: 'linked',
  name: 'Linked',
  links: {
    'istar.ContributionLink': [
      { key: 'weight', value: { type: 'int', min: 0 }, help: 'how much' },
      { key: 'note', value: { type: 'text' }, help: 'why' },
    ],
    'toyish.Feeds': [
      { key: 'rate', value: { type: 'int' }, help: 'how often' },
    ],
  },
  actors: [{ key: 'budget', value: { type: 'int' }, help: 'its cap' }],
});

const link = (
  iStarId: string,
  source: string,
  target: string,
  properties: Record<string, string>,
  kind = 'istar.ContributionLink',
): DocumentLink => ({ iStarId, kind, source, target, properties });

const tree = (links: DocumentLink[]): DocumentTree => ({
  nodes: new Map([
    [
      'G1',
      node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1', 'T2'] }),
    ],
    [
      'T1',
      node({
        id: 'T1',
        kind: 'task',
        name: 'Drive',
        properties: { robot: 'r2' },
      }),
    ],
    ['T2', node({ id: 'T2', kind: 'task', name: 'Fly' })],
  ]),
  roots: ['G1'],
  links,
  actors: [
    {
      iStarId: 'a1',
      kind: 'istar.Actor',
      name: 'Ann',
      properties: { budget: '5' },
      elements: ['G1', 'T1', 'T2'],
    },
  ],
});

const WEIGHTED = tree([
  link('l1', 'T1', 'G1', { weight: '50', note: 'cheap' }),
  link('l2', 'T2', 'G1', {}),
  link('l3', 'G1', 'T1', { weight: '1' }, 'istar.AndRefinementLink'),
]);

describe('link lines (#107)', () => {
  it('reads a link line’s value: the target, then {key = value} each, with spans', () => {
    const read = readLinkLine('G1 {weight = 50}  { note =  cheap and fast }');
    expect('value' in read && read.value).to.deep.equal({
      target: 'G1',
      targetSpan: { from: 0, to: 2 },
      properties: [
        {
          key: 'weight',
          value: '50',
          keySpan: { from: 4, to: 10 },
          valueSpan: { from: 13, to: 15 },
        },
        {
          key: 'note',
          value: 'cheap and fast',
          keySpan: { from: 20, to: 24 },
          valueSpan: { from: 28, to: 42 },
        },
      ],
    });
    expect(readLinkLine('G1')).to.deep.equal({
      value: { target: 'G1', targetSpan: { from: 0, to: 2 }, properties: [] },
    });
    expect(readLinkLine('{weight = 5}')).to.have.property('error');
    expect(readLinkLine('G1 weight = 5')).to.deep.equal({
      error: { message: 'Not a {key = value}', from: 3, to: 13 },
    });
  });

  it('writes a link’s declared properties, in the kind’s order', () => {
    expect(
      linkLine(
        linked,
        link('l', 'T1', 'G1', { note: 'x', weight: '2', other: 'y' }),
        'G1',
      ),
    ).to.equal('link G1 {weight = 2} {note = x}');
  });

  it('leaves out a value with a brace, which no line could read back; a link with only such values has no line', () => {
    const braced = link('l', 'T1', 'G1', { weight: '2', note: 'a {b}' });
    expect(linkLine(linked, braced, 'G1')).to.equal('link G1 {weight = 2}');
    expect(hasLinkLine(linked, braced)).to.equal(true);
    expect(
      hasLinkLine(linked, link('l', 'T1', 'G1', { note: '{only}' })),
    ).to.equal(false);
    // the line's value (after its `link ` key) reads back
    expect(
      readLinkLine(linkLine(linked, braced, 'G1').replace(/^link /, '')),
    ).to.have.property('value');
  });

  it('writes a link line under its source, after its properties; a link without properties has none', () => {
    expect(notationDocument(linked, WEIGHTED)).to.deep.equal({
      text: 'G1: Go\n  T1: Drive\n    robot r2\n    link G1 {weight = 50} {note = cheap}\n  T2: Fly',
      ids: ['G1', 'T1', 'T1', 'T1', 'T2'],
    });
  });

  it('writes nothing new in a dialect without links (every existing document as before)', () => {
    expect(notationDocument(toy, WEIGHTED)).to.deep.equal(
      notationDocument(toy, { ...WEIGHTED, links: [] }),
    );
  });

  it('maps a link line’s edits back to the link’s properties', () => {
    const { text } = notationDocument(linked, WEIGHTED);
    expect(notationEdits(linked, text, WEIGHTED)).to.deep.equal([]);
    const changed = text
      .replace('{weight = 50} {note = cheap}', '{weight = 60}')
      .replace('  T2: Fly', '  T2: Fly\n    link G1 {weight = 7}')
      .replace('robot r2', 'robot r3');
    expect(notationEdits(linked, changed, WEIGHTED)).to.deep.equal([
      { link: 'l1', key: 'weight', value: '60' },
      { link: 'l1', key: 'note', value: null },
      { link: 'l2', key: 'weight', value: '7' },
      // the element's own properties as before
      { iStarId: 'i-T1', key: 'robot', value: 'r3' },
    ]);
    // the line removed: its properties are; while it is being typed, they stay
    const removed = text.replace(
      '\n    link G1 {weight = 50} {note = cheap}',
      '',
    );
    expect(notationEdits(linked, removed, WEIGHTED)).to.deep.equal([
      { link: 'l1', key: 'weight', value: null },
      { link: 'l1', key: 'note', value: null },
    ]);
    const typing = text.replace(
      'link G1 {weight = 50} {note = cheap}',
      'link G1 {weig',
    );
    expect(notationEdits(linked, typing, WEIGHTED)).to.deep.equal([]);
  });

  it('changes nothing for a target two links of kinds with properties share', () => {
    const both = tree([
      link('l1', 'T1', 'G1', { weight: '50' }),
      link('f1', 'T1', 'G1', { rate: '3' }, 'toyish.Feeds'),
    ]);
    const { text } = notationDocument(linked, both);
    expect(text).to.include('link G1 {weight = 50}');
    expect(text).to.include('link G1 {rate = 3}');
    expect(
      notationEdits(linked, text.replace('{rate = 3}', '{rate = 4}'), both),
    ).to.deep.equal([]);
  });

  describe('diagnostics', () => {
    const context = (t: DocumentTree): DefinitionContext =>
      contextFromView(linked, t, []);
    const messages = (doc: string, t = WEIGHTED) =>
      documentDiagnostics(linked, doc, context(t)).map((d) => [
        doc.slice(d.from, d.to),
        d.message,
      ]);
    const under = (line: string) =>
      `G1: Go\n  T1: Drive\n    ${line}\n  T2: Fly`;

    it('says nothing of a line that names its link and sets what its kind declares', () => {
      expect(
        messages(under('link G1 {weight = 50} {note = cheap}')),
      ).to.deep.equal([]);
    });

    it('reports the target, the link, a key and a value that aren’t right', () => {
      expect(messages(under('link G9 {weight = 50}'))).to.deep.equal([
        ['G9', 'No element G9'],
      ]);
      expect(messages(under('link T2 {weight = 50}'))).to.deep.equal([
        ['T2', 'No link from T1 to T2 has properties in Linked'],
      ]);
      expect(
        messages(under('link G1 {speed = 5} {weight = -1}')),
      ).to.deep.equal([
        ['speed', 'Not a property of a ContributionLink'],
        ['-1', 'At least 0'],
      ]);
      expect(
        messages(under('link G1 {weight = 5}\n    link G1 {weight = 6}')),
      ).to.deep.equal([['G1', 'The link to G1 is written twice']]);
      expect(messages(under('link {weight = 5}'))).to.deep.equal([
        [
          '{weight = 5}',
          'A link line names its target first: link G1 {key = value}',
        ],
      ]);
    });

    it('reports a line two links could be', () => {
      const both = tree([
        link('l1', 'T1', 'G1', {}),
        link('f1', 'T1', 'G1', {}, 'toyish.Feeds'),
      ]);
      expect(messages(under('link G1 {weight = 5}'), both)).to.deep.equal([
        [
          'G1',
          "Links of 2 kinds join T1 to G1: which one this line is can't be told",
        ],
      ]);
    });

    it('keeps `link` an unknown key in a dialect without links', () => {
      const [found] = documentDiagnostics(
        toy,
        under('link G1 {weight = 5}'),
        contextFromView(toy, WEIGHTED, []),
      );
      expect(found?.message).to.equal('Not read for a task');
    });
  });

  it('gives checks readLink and readActor where the dialect declares them, and nothing new elsewhere', () => {
    const check = checkContextOf(contextFromView(linked, WEIGHTED, []), 'T1');
    expect(check.readLink?.('l1')).to.deep.equal({
      kind: 'istar.ContributionLink',
      source: 'T1',
      target: 'G1',
      properties: { weight: '50', note: 'cheap' },
    });
    expect(check.readActor?.('a1')).to.deep.equal({
      kind: 'istar.Actor',
      name: 'Ann',
      properties: { budget: '5' },
      elements: ['G1', 'T1', 'T2'],
    });
    const plain = checkContextOf(contextFromView(toy, WEIGHTED, []), 'T1');
    expect(plain).not.to.have.property('readLink');
    expect(plain).not.to.have.property('readActor');
  });
});

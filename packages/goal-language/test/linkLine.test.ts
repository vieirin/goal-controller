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
  fieldDiagnostics,
  hasLinkLine,
  linkLine,
  notationDocument,
  notationEdits,
  readLine,
  readLinkLine,
  type AnyCheckInput,
  type RunCheck,
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
    // its actor's budget is an actor line at the top (#109), which is no element's
    expect(notationDocument(linked, WEIGHTED)).to.deep.equal({
      text: 'actor "Ann" {budget = 5}\nG1: Go\n  T1: Drive\n    robot r2\n    link G1 {weight = 50} {note = cheap}\n  T2: Fly',
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

/**
 * A dialect without ids that writes link lines (`linkLines`): a target is
 * named by its line's text, quoted, `#n` the n-th of several so named.
 */
const plainLinked = defineDialect({
  id: 'plainLinked',
  name: 'Plain',
  elements: {
    goal: { fill: '#00FF00' },
    task: { fill: '#00FF00' },
  },
  defaultFill: '#FFFFFF',
  properties: { goal: [], task: [] },
  propertyLineOrder: [],
  indent: '  ',
  problems: toy.problems,
  linkLines: true,
  links: {
    'istar.ContributionLink': [
      { key: 'weight', value: { type: 'int', min: 0 }, help: 'how much' },
      {
        key: 'kind',
        value: { type: 'text' },
        help: 'checked',
        check: 'plain.kind',
      },
    ],
  },
});

/** Go, two tasks named Heat, and one whose name has quotes: no ids, keys are piStar's. */
const plainTree = (links: DocumentLink[]): DocumentTree => ({
  nodes: new Map([
    [
      'g',
      node({
        id: 'g',
        kind: 'goal',
        name: 'Go',
        children: ['h1', 'h2', 'q'],
      }),
    ],
    ['h1', node({ id: 'h1', kind: 'task', name: 'Heat' })],
    ['h2', node({ id: 'h2', kind: 'task', name: 'Heat' })],
    ['q', node({ id: 'q', kind: 'task', name: 'Say "hi"' })],
  ]),
  roots: ['g'],
  links,
});

const PLAIN = plainTree([
  link('l1', 'h1', 'g', { weight: '50' }),
  link('l2', 'q', 'h2', { weight: '1', kind: 'soft' }),
  link('l3', 'h2', 'q', {}),
]);

const PLAIN_TEXT = [
  'Go',
  '  Heat',
  '    link "Go" {weight = 50}',
  '  Heat',
  '  Say "hi"',
  '    link "Heat"#2 {weight = 1} {kind = soft}',
].join('\n');

describe('link lines without ids (linkLines)', () => {
  it('writes the target by its text, quoted, #n among elements so named; the line takes no place in the order', () => {
    expect(notationDocument(plainLinked, PLAIN)).to.deep.equal({
      text: PLAIN_TEXT,
      ids: ['g', 'h1', 'h2', 'q'],
    });
    expect(
      notationDocument(
        plainLinked,
        plainTree([link('l', 'h1', 'q', { weight: '2' })]),
      ).text,
    ).to.include('link "Say \\"hi\\"" {weight = 2}');
  });

  it('writes none, and leaves the links be, where the dialect without ids doesn’t turn them on', () => {
    const off = { ...plainLinked, linkLines: undefined };
    const { text } = notationDocument(off, PLAIN);
    expect(text).to.equal('Go\n  Heat\n  Heat\n  Say "hi"');
    expect(notationEdits(off, text, PLAIN)).to.deep.equal([]);
    // and a dialect with ids may turn them off
    expect(
      notationDocument({ ...linked, linkLines: false }, WEIGHTED).text,
    ).not.to.include('link');
  });

  it('reads `link "…` as a link line, and anything else as an element line', () => {
    expect(readLine(plainLinked, '    link "Go" {weight = 5}')).to.include({
      kind: 'property',
      key: 'link',
      value: '"Go" {weight = 5}',
    });
    expect(readLine(plainLinked, '  link the accounts')).to.include({
      kind: 'element',
    });
    const read = readLinkLine('"Say \\"hi\\""#2 {weight = 5}');
    expect('value' in read && read.value.target).to.equal('"Say \\"hi\\""#2');
    expect(readLinkLine('"Heat {weight = 5}')).to.have.property('error');
  });

  it('maps a link line’s edits back to the link it names', () => {
    expect(notationEdits(plainLinked, PLAIN_TEXT, PLAIN)).to.deep.equal([]);
    const tree = PLAIN;
    const edited = PLAIN_TEXT.replace('{weight = 50}', '{weight = 60}').replace(
      '{weight = 1} {kind = soft}',
      '{weight = 1}',
    );
    expect(notationEdits(plainLinked, edited, tree)).to.deep.equal([
      { link: 'l1', key: 'weight', value: '60' },
      { link: 'l2', key: 'kind', value: null },
    ]);
    // a target that names no element, or two (being typed): nothing changes
    for (const target of ['"Nope"', '"Heat"', '"Heat"#3'])
      expect(
        notationEdits(
          plainLinked,
          PLAIN_TEXT.replace('"Heat"#2 {weight = 1}', `${target} {weight = 9}`),
          tree,
        ),
      ).to.deep.equal([]);
  });

  it('reads a link line removed or added: the elements keep their lines', () => {
    // removed: its link's properties are
    expect(
      notationEdits(
        plainLinked,
        PLAIN_TEXT.replace('\n    link "Go" {weight = 50}', ''),
        PLAIN,
      ),
    ).to.deep.equal([{ link: 'l1', key: 'weight', value: null }]);
    // added under the second Heat: l3 takes the properties it writes
    expect(
      notationEdits(
        plainLinked,
        PLAIN_TEXT.replace(
          '  Heat\n  Say',
          '  Heat\n    link "Say \\"hi\\"" {weight = 3}\n  Say',
        ),
        PLAIN,
      ),
    ).to.deep.equal([{ link: 'l3', key: 'weight', value: '3' }]);
  });

  it('names no element `constructor` or `__proto__` would inherit', () => {
    const tree = plainTree([]);
    tree.nodes.get('h1')!.name = 'constructor';
    tree.nodes.get('h2')!.name = '__proto__';
    expect(contextFromView(plainLinked, tree, []).names).to.deep.include({
      constructor: ['h1'],
      ['__proto__']: ['h2'],
    });
  });

  describe('diagnostics', () => {
    const run: RunCheck = (name, { props }, self) => {
      // the check reads the link it is on
      const read = checkContextOf(
        contextFromView(plainLinked, PLAIN, []),
        self,
      ).readLink?.(self);
      return name === 'plain.kind' && props.kind === 'hard'
        ? `hard from ${read?.source} to ${read?.target}`
        : null;
    };
    const messages = (doc: string) =>
      documentDiagnostics(
        plainLinked,
        doc,
        contextFromView(plainLinked, PLAIN, []),
        { runCheck: run },
      ).map((d) => [doc.slice(d.from, d.to), d.message]);
    const replace = (line: string) =>
      PLAIN_TEXT.replace('link "Heat"#2 {weight = 1} {kind = soft}', line);

    it('says nothing of the document as written', () => {
      expect(messages(PLAIN_TEXT)).to.deep.equal([]);
    });

    it('counts no link line as an element’s', () => {
      expect(
        messages(PLAIN_TEXT.replace('\n    link "Go" {weight = 50}', '')),
      ).to.deep.equal([]);
    });

    it('reports a target that names no element, or several', () => {
      expect(messages(replace('link "Nope" {weight = 1}'))).to.deep.equal([
        ['"Nope"', 'No element "Nope"'],
      ]);
      expect(messages(replace('link "Heat" {weight = 1}'))).to.deep.equal([
        ['"Heat"', '2 elements are named "Heat": write "Heat"#1, "Heat"#2'],
      ]);
      expect(messages(replace('link "Heat"#3 {weight = 1}'))).to.deep.equal([
        ['"Heat"#3', 'No element "Heat"#3: 2 are named so'],
      ]);
      expect(messages(replace('link "Heat"#1 {weight = 1}'))).to.deep.equal([
        [
          '"Heat"#1',
          'No link from "Say \\"hi\\"" to "Heat"#1 has properties in Plain',
        ],
      ]);
    });

    it('checks a value against its config, and runs its named check with the link as self', () => {
      expect(
        messages(replace('link "Heat"#2 {weight = -1} {kind = hard}')),
      ).to.deep.equal([
        ['-1', 'At least 0'],
        ['hard', 'hard from q to h2'],
      ]);
    });

    it("gives a link field's check the link's other properties, as its line does (#257)", () => {
      const seen: AnyCheckInput[] = [];
      const check: RunCheck = (_name, input) => {
        seen.push(input);
        return input.props.weight === 1 ? 'hard at weight 1' : null;
      };
      const model = contextFromView(plainLinked, PLAIN, []);
      expect(
        fieldDiagnostics(plainLinked, model, 'l2', 'kind', 'hard', check).map(
          (d) => d.message,
        ),
      ).to.deep.equal(['hard at weight 1']);
      expect(seen).to.deep.equal([
        {
          props: { weight: 1, kind: 'hard' },
          raw: { weight: '1', kind: 'hard' },
          kind: 'istar.ContributionLink',
        },
      ]);
    });
  });
});

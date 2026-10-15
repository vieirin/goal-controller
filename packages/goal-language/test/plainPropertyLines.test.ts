/**
 * Property lines in a document without ids (goal-controller#138): a line
 * that starts with one of the dialect's declared keys is a property line of
 * the element line above it; any other line is an element's, by position.
 * A name that would read as a property line is written quoted.
 */
import {
  defineDialect,
  type DocumentLink,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  definitionAt,
  documentDiagnostics,
  highlightLine,
  hoverAt,
  notationDocument,
  notationEdits,
  parseDocument,
  propertyKeyOf,
  propertyKeysOf,
  readLine,
  takesPosition,
  unquotedName,
  writtenName,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

/** No ids; a goal has a type (an enum) and an achievement condition (an assertion). */
const plain = defineDialect({
  id: 'plainToy',
  name: 'Plain toy',
  elements: {
    goal: { fill: '#00FF00' },
    task: { fill: '#00FF00' },
  },
  defaultFill: '#FFFFFF',
  properties: {
    goal: [
      {
        key: 'type',
        value: {
          type: 'enum',
          options: [
            { value: 'achieve', label: 'achieve' },
            { value: 'maintain', label: 'maintain' },
          ],
        },
        help: 'its goal type',
      },
      {
        key: 'achievement',
        value: {
          type: 'assertion',
          resolves: ['variable'],
          declaresVariables: true,
        },
        help: 'when it is achieved',
      },
    ],
    task: [],
  },
  propertyLineOrder: ['type', 'achievement'],
  indent: '  ',
  problems: toy.problems,
  linkLines: true,
  links: {
    'istar.ContributionLink': [
      { key: 'weight', value: { type: 'int' }, help: 'how much' },
    ],
  },
});

const link = (
  iStarId: string,
  source: string,
  target: string,
  properties: Record<string, string>,
): DocumentLink => ({
  iStarId,
  kind: 'istar.ContributionLink',
  source,
  target,
  properties,
});

/** RoomClean, a goal named as a property line would read, and a quoted one. */
const TREE: DocumentTree = {
  nodes: new Map([
    [
      'rc',
      node({
        id: 'rc',
        kind: 'goal',
        name: 'RoomClean',
        properties: { type: 'achieve', achievement: 'roomClean' },
        children: ['ta', 'q'],
      }),
    ],
    [
      'ta',
      node({
        id: 'ta',
        kind: 'goal',
        name: 'type achieve',
        properties: { type: 'maintain' },
      }),
    ],
    ['q', node({ id: 'q', kind: 'task', name: '"sweep"' })],
  ]),
  roots: ['rc'],
  links: [link('l1', 'q', 'ta', { weight: '2' })],
};

const TEXT = [
  'RoomClean',
  '  type achieve',
  '  achievement roomClean',
  '  "type achieve"',
  '    type maintain',
  '  "\\"sweep\\""',
  '    link "type achieve" {weight = 2}',
].join('\n');

describe('property lines without ids (goal-controller#138)', () => {
  it('reads a line starting with a declared key as a property line, any other as an element line', () => {
    expect(readLine(plain, '  achievement roomClean')).to.deep.include({
      kind: 'property',
      key: 'achievement',
      keySpan: { from: 2, to: 13 },
      value: 'roomClean',
      valueSpan: { from: 14, to: 23 },
      errors: [],
    });
    expect(readLine(plain, '  type')).to.include({
      kind: 'property',
      key: 'type',
      value: '',
    });
    // a key is a whole word, at the line's start, before any annotation
    for (const line of ['RoomClean', '  typed in', 'achievements', 'Type it'])
      expect(readLine(plain, line).kind, line).to.equal('element');
    // a dialect without declared keys reads them as names, as before
    const none = { ...plain, propertyLineOrder: [] };
    expect(readLine(none, '  type achieve')).to.include({
      kind: 'element',
      name: 'type achieve',
    });
    expect(propertyKeysOf(none)).to.deep.equal([]);
    // with ids, any key starts a property line: no keys are given
    expect(propertyKeysOf(toy)).to.deep.equal([]);
  });

  it('reads a quoted name as the name in its quotes', () => {
    const read = readLine(plain, '  "type achieve"');
    expect(read).to.include({
      kind: 'element',
      name: 'type achieve',
      text: 'type achieve',
    });
    expect(read.kind === 'element' && read.textSpan).to.deep.equal({
      from: 2,
      to: 16,
    });
    expect(readLine(plain, '"\\"sweep\\""')).to.include({
      name: '"sweep"',
    });
    // a quote inside a name is the name's
    expect(readLine(plain, 'Say "hi"')).to.include({ name: 'Say "hi"' });
    // without declared keys nothing is quoted: GRL's names stay as written
    expect(readLine({ ...plain, propertyLineOrder: [] }, '"sweep"')).to.include(
      { name: '"sweep"' },
    );
  });

  it('quotes a name that would read as a property line, or that is quoted', () => {
    expect(writtenName(plain, 'type achieve')).to.equal('"type achieve"');
    expect(writtenName(plain, 'type')).to.equal('"type"');
    expect(writtenName(plain, '"sweep"')).to.equal('"\\"sweep\\""');
    for (const name of ['RoomClean', 'typed', 'Say "hi"', 'achievements'])
      expect(writtenName(plain, name)).to.equal(name);
    expect(writtenName({ ...plain, propertyLineOrder: [] }, 'type x')).to.equal(
      'type x',
    );
    expect(writtenName(toy, 'type x')).to.equal('type x');
    for (const name of ['type achieve', '"sweep"', 'type a \\ b "c"'])
      expect(unquotedName(writtenName(plain, name))).to.equal(name);
    expect(propertyKeyOf(['type', 'typed'], '  typed x')).to.equal('typed');
    expect(propertyKeyOf(['type'], 'type\tx')).to.equal('type');
    expect(propertyKeyOf(['type'], 'type-x')).to.equal(null);
  });

  it('writes an element’s properties under its line, in propertyLineOrder, indented; they take no position', () => {
    expect(notationDocument(plain, TREE)).to.deep.equal({
      text: TEXT,
      ids: ['rc', 'ta', 'q'],
    });
    for (const line of TEXT.split('\n'))
      expect(takesPosition(plain, line), line).to.equal(
        !/^\s*(type|achievement|link) /.test(line),
      );
  });

  it('round-trips the document: nothing changes, and a property line sets its property', () => {
    expect(notationEdits(plain, TEXT, TREE)).to.deep.equal([]);
    expect(
      notationEdits(
        plain,
        TEXT.replace('achievement roomClean', 'achievement roomClean & dry'),
        TREE,
      ),
    ).to.deep.equal([
      { iStarId: 'i-rc', key: 'achievement', value: 'roomClean & dry' },
    ]);
    // removed, added: the elements keep their positions
    expect(
      notationEdits(plain, TEXT.replace('\n    type maintain', ''), TREE),
    ).to.deep.equal([{ iStarId: 'i-ta', key: 'type', value: null }]);
    expect(
      notationEdits(
        plain,
        TEXT.replace(
          '    type maintain',
          '    type maintain\n    achievement x',
        ),
        TREE,
      ),
    ).to.deep.equal([{ iStarId: 'i-ta', key: 'achievement', value: 'x' }]);
    // a quoted name renamed: its text is the name in the quotes
    expect(
      notationEdits(
        plain,
        TEXT.replace('"type achieve"\n', '"type achieved"\n'),
        TREE,
      ),
    ).to.deep.equal([{ iStarId: 'i-ta', text: 'type achieved' }]);
    // unquoted, it is a property line: a line short of the elements
    expect(
      notationEdits(
        plain,
        TEXT.replace('"type achieve"\n', 'type achieve\n'),
        TREE,
      ),
    ).to.deep.equal([]);
  });

  it('parses a whole document with its keys', () => {
    const { value, errors } = parseDocument(TEXT, {
      ids: false,
      keys: propertyKeysOf(plain),
    });
    expect(errors).to.deep.equal([]);
    expect(value.map((line) => line.kind)).to.deep.equal([
      'element',
      'property',
      'property',
      'element',
      'property',
      'element',
      'element',
    ]);
    expect(value[2]).to.include({ key: 'achievement', value: 'roomClean' });
    // without keys, every line is an element's
    expect(
      parseDocument(TEXT, { ids: false }).value.every(
        (line) => line.kind === 'element',
      ),
    ).to.equal(true);
  });

  it('checks a property line’s value by its type, and its key by the element above', () => {
    const context = contextFromView(plain, TREE, []);
    expect(documentDiagnostics(plain, TEXT, context)).to.deep.equal([]);
    const wrong = TEXT.replace('type achieve\n', 'type perform\n');
    const [enumProblem] = documentDiagnostics(plain, wrong, context);
    expect(enumProblem).to.include({
      severity: 'error',
      message: 'One of achieve, maintain, not perform',
      elementId: 'rc',
    });
    // on the line, as a property line with ids is
    expect(wrong.slice(enumProblem!.from, enumProblem!.to)).to.equal(
      'type perform',
    );
    const condition = TEXT.replace('roomClean', 'roomClean &');
    expect(
      documentDiagnostics(plain, condition, context).map((d) => d.elementId),
    ).to.deep.equal(['rc']);
    // a task reads no type
    const task = TEXT.replace('\n    link', '\n    type achieve\n    link');
    const keyAt = task.lastIndexOf('\n    type achieve') + 5;
    expect(documentDiagnostics(plain, task, context)).to.deep.equal([
      {
        from: keyAt,
        to: keyAt + 4,
        severity: 'warning',
        message: 'Not read for a task',
        elementId: 'q',
      },
    ]);
  });

  it('completes a key after the indent on a line of its own, and a value by its type', () => {
    const context = contextFromView(plain, TREE, []);
    const labels = (doc: string, pos = doc.length) =>
      completionsAt(plain, doc, pos, context)?.options.map((o) => o.label) ??
      null;
    const under = TEXT.replace('    type maintain', '    type maintain\n    ');
    const at = under.indexOf('maintain\n') + 'maintain\n    '.length;
    expect(labels(under, at)).to.deep.equal(['achievement']);
    // a key being typed: the line is past the elements'
    const typing = TEXT.replace(
      '    type maintain',
      '    type maintain\n    ach',
    );
    expect(labels(typing, typing.lastIndexOf('    ach') + 7)).to.deep.equal([
      'achievement',
    ]);
    // on an element's own line, no keys
    expect(labels(TEXT, 'Room'.length)).to.equal(null);
    // the value of an enum: its options
    const value = TEXT.replace('type achieve\n', 'type \n');
    expect(labels(value, value.indexOf('type ') + 5)).to.include.members([
      'achieve',
      'maintain',
    ]);
  });

  it('explains a key by the element at its position, and leads a name in a value to its line', () => {
    // a task's type is another property than a goal's
    const typed = {
      ...plain,
      properties: {
        ...plain.properties,
        task: [{ key: 'type', value: { type: 'text' }, help: 'what it does' }],
      },
    } as typeof plain;
    const doc = `${TEXT}\n    type sweeping`;
    const context = contextFromView(typed, TREE, []);
    const hover = (pos: number) => hoverAt(typed, doc, pos, context)?.markdown;
    expect(hover(doc.indexOf('type achieve') + 1)).to.equal(
      '**type**: its goal type',
    );
    expect(hover(doc.lastIndexOf('type') + 1)).to.equal(
      '**type**: what it does',
    );
    const named = TEXT.replace('roomClean', 'RoomClean');
    expect(
      definitionAt(plain, named, named.indexOf('RoomClean', 9)),
    ).to.deep.equal({ from: 0, to: 'RoomClean'.length });
  });

  it('highlights a property line’s key and its value as its type reads', () => {
    const [key, value] = highlightLine(plain, '  type achieve');
    expect(key).to.include({ from: 2, to: 6, style: 'propertyName' });
    expect(value).to.include({ from: 7, to: 14, style: 'atom' });
    expect(highlightLine(plain, 'RoomClean')[0]?.style).to.not.equal(
      'propertyName',
    );
  });
});

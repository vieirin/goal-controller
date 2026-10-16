/**
 * A set of an enum's options (goal-controller#162): `{days = mon, wed}` on
 * an element's property line and on a link line reads, validates and
 * completes as some of the options, each once; engines read it with
 * `readEnumSet`.
 */
import {
  defineDialect,
  inputFor,
  property,
  type DocumentLink,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  enumSetText,
  fieldCompletions,
  fieldDiagnostics,
  highlightValue,
  notationDocument,
  notationEdits,
  parseValue,
  readEnumSet,
  toggleEnumSet,
} from '../src/index.js';
import { node, sensed } from '../../dialect/test/support/toy.js';

const DAYS = ['mon', 'tue', ['wed', 'Wednesday']] as const;

/** a toy rota: a task's days, and the days a dependency holds on */
const rota = defineDialect({
  ...sensed,
  id: 'rota',
  name: 'Rota',
  properties: {
    ...sensed.properties,
    task: [
      ...sensed.properties.task,
      property.enumSet('days', DAYS, { help: 'the days it runs' }),
    ],
  },
  propertyLineOrder: [...sensed.propertyLineOrder, 'days'],
  links: {
    'istar.DependencyLink': [
      property.enumSet('days', DAYS, { help: 'the days it holds' }),
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
  kind: 'istar.DependencyLink',
  source,
  target,
  properties,
});

const tree: DocumentTree = {
  nodes: new Map([
    ['G1', node({ id: 'G1', kind: 'goal', name: 'Staff', children: ['T1'] })],
    [
      'T1',
      node({
        id: 'T1',
        kind: 'task',
        name: 'Open',
        properties: { days: 'mon' },
      }),
    ],
    ['G2', node({ id: 'G2', kind: 'goal', name: 'Clean' })],
  ]),
  roots: ['G1', 'G2'],
  links: [link('dep', 'G2', 'T1', { days: 'mon, wed' })],
};

const context = contextFromView(rota, tree, []);
const DOC = notationDocument(rota, tree).text;
const messages = (doc: string) =>
  documentDiagnostics(rota, doc, context).map((d) => d.message);

describe('enumSet: some of an enum’s options (#162)', () => {
  it('reads a set in the order written, empty when unset, null when it isn’t one', () => {
    expect(readEnumSet('mon, wed')).to.deep.equal(['mon', 'wed']);
    expect(readEnumSet('  tue  ')).to.deep.equal(['tue']);
    expect(readEnumSet('')).to.deep.equal([]);
    expect(readEnumSet('mon,, wed')).to.equal(null);
    expect(readEnumSet('mon,')).to.equal(null);
    expect(enumSetText(['mon', 'wed'])).to.equal('mon, wed');
    expect(toggleEnumSet('wed', 'mon', true)).to.equal('wed, mon');
    expect(toggleEnumSet('mon, wed', 'mon', true)).to.equal('mon, wed');
    expect(toggleEnumSet('mon, wed', 'mon', false)).to.equal('wed');
    expect(toggleEnumSet('mon', 'mon', false)).to.equal('');
    expect(toggleEnumSet('', 'tue', true)).to.equal('tue');
    expect(toggleEnumSet('mon,', 'tue', true)).to.equal(null);
    expect(parseValue('enumSet', 'two words, x').value).to.deep.equal([
      'two words',
      'x',
    ]);
  });

  it('writes property and link lines, and reads them back unchanged', () => {
    expect(DOC).to.include('T1: Open\n    days mon');
    expect(DOC).to.include('link T1 {days = mon, wed}');
    expect(messages(DOC)).to.deep.equal([]);
    expect(notationEdits(rota, DOC, tree)).to.deep.equal([]);
    expect(
      notationEdits(rota, DOC.replace('mon, wed', 'tue, mon'), tree),
    ).to.deep.equal([{ link: 'dep', key: 'days', value: 'tue, mon' }]);
  });

  it('reports a value that is no option, one written twice, and a list that isn’t one', () => {
    expect(
      messages(
        DOC.replace('days mon', 'days mon, sun').replace(
          'mon, wed',
          'wed, wed',
        ),
      ),
    ).to.deep.equal(['One of mon, tue, wed, not sun', 'wed is written twice']);
    expect(
      fieldDiagnostics(rota, context, 'T1', 'days', 'mon,', undefined).map(
        (d) => d.message,
      ),
    ).to.deep.equal(['Some of mon, tue, wed, comma-separated']);
  });

  it('completes the options not written yet, after the last comma', () => {
    expect(
      fieldCompletions(rota, context, 'T1', 'days', 'mon, ', 5)?.options.map(
        (o) => o.label,
      ),
    ).to.deep.equal(['tue', 'wed']);
    const result = fieldCompletions(rota, context, 'T1', 'days', 'tue, w', 6);
    expect(result?.from).to.equal(5);
    expect(result?.options.map((o) => o.label)).to.deep.equal(['mon', 'wed']);
    // in the middle: the options after the cursor are written too
    expect(
      fieldCompletions(rota, context, 'T1', 'days', ', wed', 0)?.options.map(
        (o) => o.label,
      ),
    ).to.deep.equal(['mon', 'tue']);
    // on a link line, at `wed`: the word typed is replaced, `mon` is written
    const at = DOC.indexOf('mon, wed') + 'mon, '.length;
    expect(
      completionsAt(rota, DOC, at, context)?.options.map((o) => o.label),
    ).to.deep.equal(['tue', 'wed']);
  });

  it('is a multiple choice in the inspector, highlighted as atoms', () => {
    expect(
      inputFor({ type: 'enumSet', options: [{ value: 'a', label: 'A' }] }, ''),
    ).to.deep.equal({
      kind: 'multiSelect',
      options: [{ value: 'a', label: 'A' }],
    });
    const styles = highlightValue(
      { type: 'enumSet', options: [] },
      'mon, wed',
    ).map((h) => h.style);
    expect(styles).to.include('atom').and.not.include('string');
  });
});

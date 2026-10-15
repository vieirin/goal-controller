/**
 * An extension's own kinds in the goal language (goal-controller#132): a
 * listed kind's lines (`S1: Probe`, its own prefix, read in its dialect
 * only) with its property lines, read back; references to its elements
 * (an assertion's, an expression's, a refList's) resolved, completed and
 * hovered as a goal's; a check reads them.
 */
import type { DocumentTree } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  checkContextOf,
  completionsAt,
  contextFromView,
  documentDiagnostics,
  highlightLine,
  hoverAt,
  notationDocument,
  notationEdits,
  parseValue,
  readLine,
  valueProblem,
} from '../src/index.js';
import { createGoalLspServices, serverDiagnostics } from '../src/lsp/server.js';
import { node, sensed, toy } from '../../dialect/test/support/toy.js';

const tree: DocumentTree = {
  nodes: new Map([
    [
      'G1',
      node({
        id: 'G1',
        kind: 'goal',
        name: 'Go',
        children: ['T1'],
        properties: { when: 'S1 > 3' },
      }),
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
    [
      'S1',
      node({
        id: 'S1',
        kind: 'sensing.Sensor',
        name: 'Probe',
        properties: { rate: '0.5', feeds: 'V1' },
      }),
    ],
    // a display: not listed, but referenced (its text's id is its key)
    ['V1', node({ id: 'V1', kind: 'sensing.Display', name: 'Panel' })],
  ]),
  roots: ['G1'],
};

const DOC = [
  'G1: Go',
  '  when S1 > 3',
  '  T1: Drive',
  '    robot r2',
  'S1: Probe',
  '  rate 0.5',
  '  feeds V1',
].join('\n');

const context = contextFromView(sensed, tree, ['x']);

const messages = (doc: string) =>
  documentDiagnostics(sensed, doc, context).map((d) => d.message);

const sensorValue = (key: string) =>
  sensed.properties['sensing.Sensor'].find((p) => p.key === key)!.value;

describe('an extension’s kinds in the goal language (#132)', () => {
  it('writes a listed kind’s element line, its property lines under it', () => {
    expect(notationDocument(sensed, tree)).to.deep.equal({
      text: DOC,
      ids: ['G1', 'G1', 'T1', 'T1', 'S1', 'S1', 'S1'],
    });
    // a dialect that lists none writes the rest as before
    expect(notationDocument(toy, tree).text).to.equal(
      'G1: Go\n  T1: Drive\n    robot r2',
    );
  });

  it('reads its prefix in its dialect only: elsewhere `S1` is a property key', () => {
    const read = readLine(sensed, 'S1: Probe');
    expect(read.kind === 'element' && read.id).to.equal('S1');
    expect(readLine(sensed, 'S1: Probe').errors).to.deep.equal([]);
    expect(readLine(toy, 'S1: Probe').kind).to.equal('property');
    // its id is a label, as a goal's
    expect(highlightLine(sensed, 'S1: Probe')[0]).to.deep.equal({
      from: 0,
      to: 2,
      style: 'labelName',
    });
    expect(highlightLine(toy, 'S1: Probe')[0]?.style).to.equal('propertyName');
  });

  it('maps its lines’ edits back to the element', () => {
    expect(notationEdits(sensed, DOC, tree)).to.deep.equal([]);
    const edited = DOC.replace('S1: Probe', 'S1: Soil probe')
      .replace('rate 0.5', 'rate 2')
      .replace('\n  feeds V1', '');
    expect(notationEdits(sensed, edited, tree)).to.deep.equal([
      { iStarId: 'i-S1', text: 'S1: Soil probe' },
      { iStarId: 'i-S1', key: 'rate', value: '2' },
      { iStarId: 'i-S1', key: 'feeds', value: null },
    ]);
  });

  it('puts the kinds it reads in the context: listed, with properties or referenced', () => {
    expect(context.elements['S1']).to.include({ kind: 'sensing.Sensor' });
    expect(context.elements['V1']).to.include({ kind: 'sensing.Display' });
    // a check reads them, by key
    expect(checkContextOf(context, 'S1').readElement?.('V1')).to.include({
      kind: 'sensing.Display',
      name: 'Panel',
    });
  });

  it('resolves references to them as to goals, and says what is wrong', () => {
    expect(messages(DOC)).to.deep.equal([]);
    expect(
      messages(
        DOC.replace('feeds V1', 'feeds G1')
          .replace('rate 0.5', 'rate fast')
          .replace('when S1 > 3', 'when V1 > 3'),
      ),
    ).to.include.members([
      'G1 is a goal, not a sensing.Display',
      'Not a number: fast',
      'V1 is not a sensing.Sensor of this model or a known variable',
    ]);
    expect(messages(`${DOC}\n  level G1 * 2`)).to.include(
      'G1 is a goal, not a sensing.Sensor',
    );
    // a listed kind's line names an element of the model
    expect(messages(`${DOC}\nS9: Gauge`)).to.include('Not in the diagram');
  });

  it('reads any id in a refList, and leaves the catalog’s as before', () => {
    expect(parseValue('refList', 'V1, S12, AT3, GX')).to.deep.include({
      value: ['V1', 'S12', 'AT3', 'GX'],
      errors: [],
    });
    expect(valueProblem(sensorValue('feeds'), 'V9', context)).to.equal(
      'V9 is not an element of this model',
    );
  });

  it('reads an expression’s name that is an element’s key as that element', () => {
    const level = sensorValue('level');
    expect(valueProblem(level, 'S1 * 2', context)).to.equal(null);
    // any other name is a variable, declared by its use
    expect(valueProblem(level, 'y * 2', context)).to.equal(null);
    expect(valueProblem(level, 'V1 + 1', context)).to.equal(
      'V1 is a sensing.Display, not a sensing.Sensor',
    );
  });

  it('completes and hovers them by kind', () => {
    const labels = (doc: string, pos = doc.length) =>
      completionsAt(sensed, doc, pos, context)?.options.map((o) => o.label);
    const feeds = DOC.replace('feeds V1', 'feeds ');
    expect(labels(feeds)).to.deep.equal(['V1']);
    const when = DOC.replace('when S1 > 3', 'when ');
    expect(labels(when, when.indexOf('when ') + 5)).to.include.members([
      'S1',
      'x',
    ]);
    expect(labels(when, when.indexOf('when ') + 5)).to.not.include('V1');
    // a listed kind's keys, under its line
    expect(labels(`${DOC.replace('\n  feeds V1', '')}\n  `)).to.deep.equal([
      'feeds',
      'level',
    ]);
    const hover = hoverAt(sensed, DOC, DOC.indexOf('V1') + 1, context);
    expect(hover?.markdown).to.include('**V1**').and.include('sensing.Display');
  });

  it('is read by the language server in its dialect', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: sensed, context });
    expect(
      await serverDiagnostics(shared, 'file:///notation.goal', DOC),
    ).to.deep.equal([]);
    const found = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      DOC.replace('feeds V1', 'feeds G1'),
    );
    expect(found.map((d) => d.message)).to.deep.equal([
      'G1 is a goal, not a sensing.Display',
    ]);
  });
});

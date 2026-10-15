/**
 * An assertion on a link that resolves an extension kind's elements
 * (goal-controller#152 item 4): a link line's `{context = S1 & !S2}` reads,
 * completes, hovers and validates as an element's assertion does, on
 * refinement, contribution and dependency links alike.
 */
import {
  defineDialect,
  type DocumentLink,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  checkContextOf,
  completionsAt,
  contextFromView,
  documentDiagnostics,
  fieldCompletions,
  fieldDiagnostics,
  fieldHover,
  hoverAt,
  notationDocument,
  notationEdits,
  readAssertion,
} from '../src/index.js';
import { node, sensed } from '../../dialect/test/support/toy.js';

/** a condition over sensors, on a link */
const CONTEXT = {
  key: 'context',
  value: { type: 'assertion', resolves: ['sensing.Sensor'] },
  help: 'when the link applies',
} as const;

const guarded = defineDialect({
  ...sensed,
  id: 'guarded',
  name: 'Guarded',
  links: {
    'istar.OrRefinementLink': [CONTEXT],
    'istar.ContributionLink': [CONTEXT],
    'istar.DependencyLink': [CONTEXT],
  },
});

const link = (
  iStarId: string,
  kind: string,
  source: string,
  target: string,
  properties: Record<string, string> = {},
): DocumentLink => ({ iStarId, kind, source, target, properties });

const tree: DocumentTree = {
  nodes: new Map([
    ['G1', node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] })],
    ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
    ['G2', node({ id: 'G2', kind: 'goal', name: 'Arrive' })],
    ['S1', node({ id: 'S1', kind: 'sensing.Sensor', name: 'Probe' })],
    ['S2', node({ id: 'S2', kind: 'sensing.Sensor', name: 'Gauge' })],
    ['V1', node({ id: 'V1', kind: 'sensing.Display', name: 'Panel' })],
  ]),
  roots: ['G1', 'G2'],
  links: [
    link('or', 'istar.OrRefinementLink', 'T1', 'G1', {
      context: 'S1 & !S2',
    }),
    link('help', 'istar.ContributionLink', 'T1', 'G2', { context: 'S2' }),
    link('dep', 'istar.DependencyLink', 'G2', 'T1', { context: '!S1' }),
  ],
};

const context = contextFromView(guarded, tree, []);
const DOC = notationDocument(guarded, tree).text;

const messages = (doc: string) =>
  documentDiagnostics(guarded, doc, context).map((d) => [
    doc.slice(d.from, d.to),
    d.message,
  ]);

describe('an assertion on a link that resolves an extension kind (#152)', () => {
  it('writes each link’s context as a link line, and reads it back unchanged', () => {
    expect(DOC).to.include('T1: Drive\n    link G1 {context = S1 & !S2}');
    expect(DOC).to.include('link G2 {context = S2}');
    expect(DOC).to.include('link T1 {context = !S1}');
    expect(messages(DOC)).to.deep.equal([]);
    expect(notationEdits(guarded, DOC, tree)).to.deep.equal([]);
    expect(
      notationEdits(
        guarded,
        DOC.replace('{context = S1 & !S2}', '{context = S2 | S1}'),
        tree,
      ),
    ).to.deep.equal([{ link: 'or', key: 'context', value: 'S2 | S1' }]);
  });

  it('reports an id that is no element of the kinds it resolves', () => {
    const bad = DOC.replace('{context = S1 & !S2}', '{context = S1 & !S9}')
      .replace('{context = S2}', '{context = V1}')
      .replace('{context = !S1}', '{context = G1}');
    expect(messages(bad).map(([, message]) => message)).to.deep.equal([
      'S9 is not a sensing.Sensor of this model',
      'V1 is not a sensing.Sensor of this model',
      'G1 is not a sensing.Sensor of this model',
    ]);
  });

  it('completes the contexts’ ids in a link line’s value, and hovers them', () => {
    const at = DOC.indexOf('S1 & !S2');
    const typing = `${DOC.slice(0, at)}${DOC.slice(at + 'S1 & !S2'.length)}`;
    const labels = completionsAt(guarded, typing, at, context)?.options.map(
      (o) => o.label,
    );
    expect(labels).to.deep.equal(['S1', 'S2', 'true', 'false']);
    const hover = hoverAt(guarded, DOC, DOC.indexOf('!S2') + 2, context);
    expect(hover?.markdown).to.include('**S2**').and.include('sensing.Sensor');
  });

  it('completes, validates and hovers the link’s field in the inspector, by its piStar id', () => {
    expect(
      fieldCompletions(
        guarded,
        context,
        'or',
        'context',
        'S1 & ',
        5,
      )?.options.map((o) => o.label),
    ).to.deep.equal(['S1', 'S2', 'true', 'false']);
    expect(
      fieldDiagnostics(
        guarded,
        context,
        'dep',
        'context',
        '!S9',
        undefined,
      ).map((d) => [d.severity, d.message]),
    ).to.deep.equal([['error', 'S9 is not a sensing.Sensor of this model']]);
    expect(
      fieldDiagnostics(
        guarded,
        context,
        'help',
        'context',
        'S1 |',
        undefined,
      ).map((d) => d.message)[0],
    ).to.match(/^Not a condition/);
    expect(
      fieldDiagnostics(guarded, context, 'help', 'context', 'S1', undefined),
    ).to.deep.equal([]);
    expect(
      fieldHover(guarded, context, 'or', 'context', 'S1 & !S2', 6)?.markdown,
    ).to.include('**S2**');
  });

  it('gives a check the link’s text, which readAssertion reads as a tree', () => {
    const check = checkContextOf(context, 'T1');
    const written = check.readLink?.('or')?.properties.context;
    expect(written).to.equal('S1 & !S2');
    expect(readAssertion(written!)).to.deep.equal({
      kind: 'and',
      left: { kind: 'var', variable: 'S1' },
      right: { kind: 'not', expr: { kind: 'var', variable: 'S2' } },
    });
  });
});

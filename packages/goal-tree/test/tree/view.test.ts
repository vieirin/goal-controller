import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { goalView } from '../../src/view';

type El = { id: string; text: string; type: string };
type Ln = { id: string; type: string; source: string; target: string };

/** A piStar file with one actor holding `nodes`, linked by `links`. */
const model = (nodes: El[], links: Ln[]) =>
  parsePistar({
    actors: [
      {
        id: 'A',
        text: 'Actor',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: nodes.map((n, i) => ({ ...n, x: 10 * i, y: 10 })),
      },
    ],
    orphans: [],
    dependencies: [],
    links,
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: '',
    diagram: { width: 100, height: 100 },
  });

const goal = (id: string, notation = ''): El => ({
  id: `e${id}`,
  text: `${id}: goal${notation}`,
  type: 'istar.Goal',
});
const task = (id: string): El => ({
  id: `e${id}`,
  text: `${id}: task`,
  type: 'istar.Task',
});
const resource = (id: string): El => ({
  id: `e${id}`,
  text: `${id}: resource`,
  type: 'istar.Resource',
});
const link =
  (type: string) =>
  (source: string, target: string): Ln => ({
    id: `${source}-${target}`,
    type,
    source: `e${source}`,
    target: `e${target}`,
  });
const and = link('istar.AndRefinementLink');
const or = link('istar.OrRefinementLink');
const neededBy = link('istar.NeededByLink');

const view = (nodes: El[], links: Ln[]) => {
  const v = goalView(model(nodes, links), 'edgeV2');
  return { ...v, node: (id: string) => v.nodes.get(id) };
};

describe('goalView (lenient)', () => {
  it('reads ids, relations and orders children by the notation', () => {
    const v = view(
      [goal('G1', ' [G3;G2]'), goal('G2'), goal('G3')],
      [and('G2', 'G1'), and('G3', 'G1')],
    );
    assert.strictEqual(v.node('G1')?.construct, 'sequence');
    assert.strictEqual(v.node('G1')?.relation, 'and');
    assert.deepStrictEqual(v.node('G1')?.children, ['G3', 'G2']);
    assert.strictEqual(v.node('G2')?.parent, 'G1');
    assert.deepStrictEqual(v.roots, ['G1']);
  });

  it('does not throw on a model the engines reject: two roots, no id, bad notation', () => {
    const v = view(
      [
        goal('G1', ' [G2;;]'),
        goal('G2'),
        { id: 'ex', text: 'no id here', type: 'istar.Task' },
      ],
      [or('x', 'G1')],
    );
    assert.deepStrictEqual(v.roots, ['G1', 'G2']);
    assert.ok(v.node('G1')?.notationError);
    assert.deepStrictEqual(v.node('G1')?.children, ['ex']);
    assert.strictEqual(v.node('ex')?.name, 'no id here');
  });

  it('gives a resource needed by several tasks to the first link in model order', () => {
    const v = view(
      [goal('G1'), task('T1'), task('T2'), resource('R1')],
      [
        and('T1', 'G1'),
        and('T2', 'G1'),
        neededBy('R1', 'T2'),
        neededBy('R1', 'T1'),
      ],
    );
    assert.strictEqual(v.node('R1')?.parent, 'T2');
    assert.deepStrictEqual(v.node('T1')?.children, ['R1']);
    assert.strictEqual(v.node('T1')?.relation, null);
  });

  it('does not follow links the engines do not read', () => {
    const v = view(
      [goal('G1'), task('T1')],
      [link('istar.ContributionLink')('T1', 'G1')],
    );
    assert.deepStrictEqual(v.node('G1')?.children, []);
    assert.strictEqual(v.node('T1')?.parent, null);
  });

  it('attaches a Quality to what it qualifies, outside the refinements', () => {
    const v = view(
      [
        goal('G1'),
        goal('G2'),
        task('T1'),
        { id: 'eQ', text: 'Autonomy', type: 'istar.Quality' },
      ],
      [
        and('G2', 'G1'),
        and('T1', 'G2'),
        link('istar.QualificationLink')('Q', 'G2'),
        link('istar.QualificationLink')('Q', 'G1'),
      ],
    );
    assert.strictEqual(v.node('G2')?.parent, 'G1');
    assert.deepStrictEqual(v.node('G2')?.qualities, ['eQ']);
    assert.deepStrictEqual(v.node('eQ')?.qualifies, ['G2', 'G1']);
    assert.deepStrictEqual(v.node('eQ')?.children, []);
    // the Quality is not a tree of its own
    assert.deepStrictEqual(v.roots, ['G1']);
  });
});

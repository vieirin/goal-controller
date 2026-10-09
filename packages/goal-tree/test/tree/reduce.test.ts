import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar, type IstarModel } from '@istar-ts/core';
import { Model } from '../../src/Model';

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

/** "child -> parent (kind)" for each link, in model order */
const edges = (m: IstarModel): string[] =>
  [...m.links.values()].map(
    (l) =>
      `${l.source.slice(1)} -> ${l.target.slice(1)} (${l.kind.replace(/^istar\.|RefinementLink$/g, '')})`,
  );
const text = (m: IstarModel, id: string) => m.elements.get(`e${id}`)?.name;

describe('Model.singleChildGoals', () => {
  it('lists goals with one refinement child and a parent, not roots or tasks', () => {
    const m = model(
      [
        goal('G0'),
        goal('G1'),
        goal('G2'),
        goal('G3'),
        task('T1'),
        task('T2'),
        task('T3'),
        resource('R1'),
      ],
      [
        // G0 (root) has a single child: kept
        and('G1', 'G0'),
        and('G2', 'G1'),
        and('G3', 'G1'),
        // G2: single child
        and('T1', 'G2'),
        // G3: two children, and a Needed-By is not a child
        or('T2', 'G3'),
        or('T3', 'G3'),
        neededBy('R1', 'T2'),
      ],
    );
    assert.deepStrictEqual(Model.singleChildGoals(m), ['eG2']);
  });
});

describe('Model.reduce', () => {
  it('links the single child to the first ancestor with more than one child', () => {
    const m = model(
      [
        goal('G1', ' [G2;G5]'),
        goal('G2', ' [G3]'),
        goal('G3', ' [T1]'),
        task('T1'),
        goal('G5', ' [T2|T3]'),
        task('T2'),
        task('T3'),
      ],
      [
        and('G2', 'G1'),
        and('G5', 'G1'),
        or('G3', 'G2'),
        and('T1', 'G3'),
        or('T2', 'G5'),
        or('T3', 'G5'),
      ],
    );
    const { model: reduced, removed } = Model.reduce(m);
    assert.deepStrictEqual(removed, ['eG2', 'eG3']);
    assert.deepStrictEqual(edges(reduced), [
      // the link into G1 keeps its id, order and kind, with T1 as the source
      'T1 -> G1 (And)',
      'G5 -> G1 (And)',
      'T2 -> G5 (Or)',
      'T3 -> G5 (Or)',
    ]);
    assert.strictEqual(reduced.links.has('G2-G1'), true);
    assert.strictEqual(text(reduced, 'G1'), 'G1: goal [T1;G5]');
    assert.strictEqual(reduced.elements.has('eG2'), false);
    assert.strictEqual(reduced.elements.has('eG3'), false);
  });

  it('keeps a root with a single child: the chain under it is linked to the root', () => {
    const m = model(
      [goal('G1', ' [G2]'), goal('G2', ' [G21]'), goal('G21'), task('T1')],
      [and('G2', 'G1'), and('G21', 'G2'), and('T1', 'G21')],
    );
    const { model: reduced, removed } = Model.reduce(m);
    assert.deepStrictEqual(removed, ['eG2', 'eG21']);
    assert.deepStrictEqual(edges(reduced), ['T1 -> G1 (And)']);
    // whole ids only: G2 is not replaced inside G21
    assert.strictEqual(text(reduced, 'G1'), 'G1: goal [T1]');
  });

  it('drops the other links of a removed goal and returns the same model when nothing reduces', () => {
    const m = model(
      [goal('G1'), goal('G2'), task('T1'), task('T2'), resource('R1')],
      [and('G2', 'G1'), and('T2', 'G1'), and('T1', 'G2'), neededBy('R1', 'G2')],
    );
    const { model: reduced } = Model.reduce(m);
    assert.deepStrictEqual(edges(reduced), [
      'T1 -> G1 (And)',
      'T2 -> G1 (And)',
    ]);
    assert.strictEqual(reduced.elements.has('eR1'), true);

    const flat = model(
      [goal('G1'), task('T1'), task('T2')],
      [and('T1', 'G1'), and('T2', 'G1')],
    );
    assert.strictEqual(Model.reduce(flat).model, flat);
  });
});

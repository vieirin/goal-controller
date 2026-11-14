/**
 * goalView (goal-controller#518): a framework dialect's written ids are any
 * (`net_up: …`), and a link one of whose ends the model lacks is an orphan.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import type { AnyDialect } from '@goal-controller/dialect';
import { goalView } from '../../src';

const node = (id: string, type: string, text = id) => ({
  id,
  text,
  type,
  x: 0,
  y: 0,
});
const link = (id: string, type: string, source: string, target: string) => ({
  id,
  type,
  source,
  target,
});

const modelOf = (
  nodes: ReturnType<typeof node>[],
  links: ReturnType<typeof link>[],
) =>
  parsePistar({
    actors: [{ id: 'a', text: 'A', type: 'istar.Actor', x: 0, y: 0, nodes }],
    orphans: [],
    dependencies: [],
    links,
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: '',
    diagram: { width: 100, height: 100 },
  });

const plain = {
  elements: { goal: { fill: '' }, task: { fill: '' } },
} as unknown as AnyDialect;
const framework = { ...plain, framework: 'nfr' } as unknown as AnyDialect;
const prefixed = {
  elements: {
    goal: { prefix: 'G', fill: '' },
    task: { prefix: 'T', fill: '' },
  },
} as unknown as AnyDialect;

describe('goalView: written ids (#518)', () => {
  const model = modelOf(
    [
      node(
        '7857cb00-aaaa',
        'istar.Goal',
        'net_up: Internet connection available',
      ),
      node('g2', 'istar.Goal', 'Achieve [Manual Backup]'),
      node('g3', 'istar.Goal', 'G1: Deliver'),
      node('g4', 'istar.Goal', 'Keep it: simple'),
    ],
    [],
  );

  it("reads any id a framework dialect's name starts with", () => {
    const view = goalView(model, framework);
    const read = (iStarId: string) => {
      const n = view.byIStarId.get(iStarId)!;
      return [n.key, n.id, n.hasId, n.name];
    };
    assert.deepStrictEqual(read('7857cb00-aaaa'), [
      'net_up',
      'net_up',
      true,
      'Internet connection available',
    ]);
    assert.deepStrictEqual(read('g2'), [
      'g2',
      'g2',
      false,
      'Achieve [Manual Backup]',
    ]);
    assert.deepStrictEqual(read('g3'), ['G1', 'G1', true, 'Deliver']);
    // a name with a space before its colon has no id
    assert.deepStrictEqual(read('g4'), ['g4', 'g4', false, 'Keep it: simple']);
  });

  it("reads any id an iStar dialect without prefixes' name starts with", () => {
    const view = goalView(model, plain);
    assert.strictEqual(view.byIStarId.get('7857cb00-aaaa')!.id, 'net_up');
    assert.strictEqual(view.byIStarId.get('g2')!.hasId, false);
    assert.strictEqual(view.byIStarId.get('g3')!.id, 'G1');
  });

  it("leaves an engine dialect's ids to its runtime notation", () => {
    const view = goalView(model, prefixed);
    assert.strictEqual(view.byIStarId.get('7857cb00-aaaa')!.hasId, false);
    assert.strictEqual(view.byIStarId.get('g3')!.id, 'G1');
  });
});

describe('goalView: orphans (#518)', () => {
  it('lists each link one of whose ends the model lacks', () => {
    const model = modelOf(
      [
        node('g1', 'istar.Goal', 'G1: Root'),
        node('t1', 'istar.Task', 'T1: Do'),
      ],
      [
        link('l1', 'istar.AndRefinementLink', 't1', 'g1'),
        link('l2', 'istar.AndRefinementLink', 'gone', 'g1'),
        link('l3', 'istar.ContributionLink', 'x', 'y'),
      ],
    );
    const view = goalView(model, plain);
    assert.deepStrictEqual(view.orphans, [
      {
        iStarId: 'l2',
        kind: 'istar.AndRefinementLink',
        source: null,
        target: 'G1',
        missing: ['gone'],
      },
      {
        iStarId: 'l3',
        kind: 'istar.ContributionLink',
        source: null,
        target: null,
        missing: ['x', 'y'],
      },
    ]);
    // the element its remaining end is keeps its other children
    assert.deepStrictEqual(view.nodes.get('G1')!.children, ['T1']);
  });

  it('has none in a whole model', () => {
    const model = modelOf(
      [
        node('g1', 'istar.Goal', 'G1: Root'),
        node('t1', 'istar.Task', 'T1: Do'),
      ],
      [link('l1', 'istar.AndRefinementLink', 't1', 'g1')],
    );
    assert.deepStrictEqual(goalView(model, plain).orphans, []);
  });
});

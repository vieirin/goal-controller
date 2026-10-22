/**
 * A dialect's link closures (goal-controller#194, #210): wherever a link of a
 * closure's first kind ends where one of its second starts, a link of its
 * `closedBy` joins the first's source to the second's target, or the chain
 * is open.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import type { LinkClosure } from '@goal-controller/dialect';
import { openClosures } from '../../src';

const node = (id: string, type: string) => ({
  id,
  text: id,
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

const closure: LinkClosure = {
  path: ['istar.ContributionLink', 'istar.QualificationLink'],
  closedBy: 'istar.DependencyLink',
  severity: 'error',
  message: '{start} {via} {end}',
};

const modelOf = (links: ReturnType<typeof link>[]) =>
  parsePistar({
    actors: [
      {
        id: 'a',
        text: 'A',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: [
          node('t1', 'istar.Task'),
          node('t2', 'istar.Task'),
          node('q', 'istar.Quality'),
          node('g', 'istar.Goal'),
        ],
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

describe('openClosures', () => {
  it('finds each chain no closing link joins, once per pair of links', () => {
    const model = modelOf([
      link('c1', 'istar.ContributionLink', 't1', 'q'),
      link('c2', 'istar.ContributionLink', 't2', 'q'),
      link('q1', 'istar.QualificationLink', 'q', 'g'),
      link('d1', 'istar.DependencyLink', 't2', 'g'),
    ]);
    const open = openClosures(model, { closures: [closure] });
    assert.deepStrictEqual(
      open.map(({ first, second, start, via, end }) => [
        first.id,
        second.id,
        start,
        via,
        end,
      ]),
      [['c1', 'q1', 't1', 'q', 'g']],
    );
    assert.strictEqual(open[0]!.closure, closure);
  });

  it('finds none without closures, or without a chain', () => {
    const model = modelOf([link('c1', 'istar.ContributionLink', 't1', 'q')]);
    assert.deepStrictEqual(openClosures(model, {}), []);
    assert.deepStrictEqual(openClosures(model, { closures: [closure] }), []);
  });
});

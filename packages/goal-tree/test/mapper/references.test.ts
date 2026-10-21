/**
 * A `reference` property, as a mapper is given it (goal-controller#243):
 * resolved against the model, by the RT id or the piStar id written; one
 * naming no element, or an element of a kind it doesn't name, is unset (the
 * dialect reports it), its text kept in `raw`. A refList's ids too
 * (goal-controller#270), of any of its kinds.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { property } from '@goal-controller/dialect';
import { createEngineMapper, GoalTree, useIstarDefaultNaming } from '../../src';

const dialect = {
  name: 'toy',
  properties: {
    goal: [],
    task: [
      property.reference('anchor', { kinds: ['goal'] }, { help: '' }),
      property.refList('after', ['goal', 'task'], { help: '' }),
    ],
    resource: [],
    quality: [],
  },
};

const task = (id: string, text: string, anchor: string, after?: string) => ({
  id,
  text,
  type: 'istar.Task',
  x: 0,
  y: 0,
  customProperties: { anchor, ...(after !== undefined && { after }) },
});

const MODEL = parsePistar({
  actors: [
    {
      id: 'a1',
      text: 'Lab',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      nodes: [
        { id: 'g1', text: 'G1: Root', type: 'istar.Goal', x: 0, y: 0 },
        task('t1', 'T1: By RT id', ' G1 ', 'G1, T2'),
        task('t2', 'T2: By piStar id', 'g1', 'G1, G9'),
        task('t3', 'T3: A task', 'T1'),
        task('t4', 'T4: Nowhere', 'G9'),
      ],
    },
  ],
  orphans: [],
  dependencies: [],
  links: ['t1', 't2', 't3', 't4'].map((source, i) => ({
    id: `l${i}`,
    type: 'istar.AndRefinementLink',
    source,
    target: 'g1',
  })),
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: '',
  diagram: { width: 100, height: 100 },
});

describe('mapper references (#243)', () => {
  it('gives a reference resolved against the model, or unset', () => {
    const seen: Record<string, unknown> = {};
    const mapper = createEngineMapper({
      dialect,
      naming: useIstarDefaultNaming(),
      elements: (entry) => [
        entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
        entry({
          kind: 'istar.Task',
          mapProps: ({ id, props, raw }) => {
            seen[id] = { anchor: props.anchor, raw: raw.anchor };
            if (raw.after !== undefined) seen[`${id} after`] = props.after;
            return {};
          },
        }),
      ],
      ignore: ['istar.Resource'],
    });
    GoalTree.goalModel(MODEL, mapper);
    assert.deepStrictEqual(seen, {
      // by its RT id, trimmed, or its piStar id: the id as written
      T1: { anchor: 'G1', raw: ' G1 ' },
      T2: { anchor: 'g1', raw: 'g1' },
      // a task, where a goal is named; no such element: unset
      T3: { anchor: undefined, raw: 'T1' },
      T4: { anchor: undefined, raw: 'G9' },
      // a refList of goals or tasks (#270): each id resolved, or none
      'T1 after': ['G1', 'T2'],
      'T2 after': undefined,
    });
  });
});

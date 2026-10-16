/**
 * A dialect's view on the canvas (goal-controller#162): what it hides of a
 * parsed model, and the stylesheet hiding it in place. An iStar model with
 * a role, a goal refined by a task, and a dependency.
 */
import { parsePistar } from '@istar-ts/core';
import { describe, expect, it } from 'vitest';
import {
  modelViewHides,
  VIEW_ATTRIBUTE,
  viewStyle,
} from '@/lib/workbench/views';

const node = (id: string, type: string, text: string) => ({
  id,
  type,
  text,
  x: 0,
  y: 0,
  customProperties: { Description: '' },
});

const model = parsePistar(
  JSON.stringify({
    actors: [
      {
        ...node('r1', 'istar.Role', 'Clerk'),
        nodes: [
          node('g1', 'istar.Goal', 'File'),
          node('t1', 'istar.Task', 'Stamp'),
        ],
      },
    ],
    orphans: [],
    dependencies: [],
    links: [
      {
        id: 'and',
        type: 'istar.AndRefinementLink',
        source: 't1',
        target: 'g1',
      },
    ],
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: 'Mon, 13 Oct 2026 00:00:00 GMT',
    diagram: { width: 800, height: 600 },
  }),
);

describe('a dialect’s view on the canvas (#162)', () => {
  it('hides the kinds it doesn’t show and the links to them, in place', () => {
    const hidden = modelViewHides(
      { label: 'Goals', kinds: ['istar.Role', 'istar.Goal'] },
      model,
    );
    expect(hidden).toEqual(['t1', 'and']);
    expect(viewStyle(hidden)).toBe(
      [
        `[${VIEW_ATTRIBUTE}] .react-flow__node[data-id="t1"]`,
        `[${VIEW_ATTRIBUTE}] .react-flow__edge[data-id="t1"]`,
        `[${VIEW_ATTRIBUTE}] .react-flow__node[data-id="and"]`,
        `[${VIEW_ATTRIBUTE}] .react-flow__edge[data-id="and"]`,
      ].join(', ') + ' { visibility: hidden; pointer-events: none; }',
    );
  });

  it('hides nothing when it shows every kind', () => {
    const hidden = modelViewHides(
      { label: 'All', kinds: ['istar.Role', 'istar.Goal', 'istar.Task'] },
      model,
    );
    expect(hidden).toEqual([]);
    expect(viewStyle(hidden)).toBe(null);
  });
});

/**
 * A model for #152's toy (toy.ts): Ann serves (when C1 or C2) by informing
 * and, when C2, guiding; she informs by showing (C1), which needs Bob to
 * fetch, or by calling (!C1), which is quick when C1; she guides by walking
 * (!C2) or with a map.
 */
const node = (
  id: string,
  type: string,
  text: string,
  context?: string,
  x = 0,
) => ({
  id,
  text,
  type,
  x,
  y: 0,
  customProperties: context === undefined ? {} : { context },
});

const link = (
  id: string,
  type: string,
  source: string,
  target: string,
  context?: string,
) => ({
  id,
  type,
  source,
  target,
  ...(context !== undefined && { customProperties: { context } }),
});

export const SITUATED_MODEL = JSON.stringify({
  actors: [
    {
      ...node('a1', 'istar.Actor', 'Ann'),
      nodes: [
        node('g1', 'istar.Goal', 'G1: Serve', 'C1 | C2'),
        node('g2', 'istar.Goal', 'G2: Inform', undefined, 100),
        node('g3', 'istar.Goal', 'G3: Guide', undefined, 200),
        node('t1', 'istar.Task', 'T1: Show', undefined, 300),
        node('t2', 'istar.Task', 'T2: Call', undefined, 400),
        node('t3', 'istar.Task', 'T3: Walk', undefined, 500),
        node('t4', 'istar.Task', 'T4: Map', undefined, 600),
        // a quality the dialect doesn't list: a contribution's link line names it
        node('q1', 'istar.Quality', 'Q1: Quick', undefined, 700),
        node('c1', 'situ.Context', 'C1: Busy', undefined, 800),
        node('c2', 'situ.Context', 'C2: Indoors', undefined, 900),
      ],
    },
    {
      ...node('b1', 'istar.Actor', 'Bob', undefined, 1000),
      nodes: [
        node('g6', 'istar.Goal', 'G6: Fetch', undefined, 1000),
        node('t5', 'istar.Task', 'T5: Bring', undefined, 1100),
      ],
    },
  ],
  orphans: [],
  dependencies: [
    { ...node('g5', 'istar.Goal', 'G5: Fetched'), source: 'a1', target: 'b1' },
  ],
  links: [
    link('l1', 'istar.AndRefinementLink', 'g2', 'g1'),
    link('l2', 'istar.AndRefinementLink', 'g3', 'g1', 'C2'),
    link('l3', 'istar.OrRefinementLink', 't1', 'g2', 'C1'),
    link('l4', 'istar.OrRefinementLink', 't2', 'g2', '!C1'),
    link('l5', 'istar.OrRefinementLink', 't3', 'g3', '!C2'),
    link('l6', 'istar.OrRefinementLink', 't4', 'g3'),
    link('l7', 'istar.OrRefinementLink', 't5', 'g6'),
    link('d1', 'istar.DependencyLink', 't1', 'g5'),
    link('d2', 'istar.DependencyLink', 'g5', 'g6'),
    {
      ...link('k1', 'istar.ContributionLink', 't2', 'q1', 'C1'),
      label: 'help',
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: 'Thu, 15 Oct 2026 00:00:00 GMT',
  diagram: { width: 1200, height: 600 },
  metamodel: {
    name: 'situ',
    elements: [{ kind: 'situ.Context', category: 'node' }],
    links: [],
  },
});

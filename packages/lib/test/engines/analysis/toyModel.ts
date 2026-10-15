/** A model for the toy dialect (toy.ts): two actors, two weighted contributions. */
const node = (id: string, type: string, text: string, x = 0) => ({
  id,
  text,
  type,
  x,
  y: 0,
  customProperties: { Description: '' },
});

/** Two actors: Ann's task contributes 3 and 4 to her goal, Bob's nothing. */
export const TOY_MODEL = JSON.stringify({
  actors: [
    {
      ...node('a1', 'istar.Actor', 'Ann'),
      customProperties: { Description: '', budget: '5' },
      nodes: [
        node('g1', 'istar.Goal', 'G1: deliver'),
        node('t1', 'istar.Task', 'T1: drive', 100),
        node('t2', 'istar.Task', 'T2: fly', 200),
      ],
    },
    { ...node('b1', 'istar.Role', 'Bob', 400), nodes: [] },
  ],
  orphans: [],
  dependencies: [],
  links: [
    {
      id: 'l1',
      type: 'istar.ContributionLink',
      source: 't1',
      target: 'g1',
      label: 'help',
      customProperties: { weight: '3' },
    },
    {
      id: 'l2',
      type: 'istar.ContributionLink',
      source: 't2',
      target: 'g1',
      label: 'make',
      customProperties: { weight: '4' },
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: 'Mon, 13 Oct 2026 00:00:00 GMT',
  diagram: { width: 800, height: 600 },
});

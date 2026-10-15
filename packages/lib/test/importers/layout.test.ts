/**
 * The layout of a model without a diagram (goal-controller#118): a
 * three-level tree with an element in no refinement in each of two actors,
 * a dependum between them and an extension's node, at positions written
 * out (the grid's step is fixed, so they are).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { layOut, type LayoutModel } from '../../src/importers/layout';

type Node = { id: string; x?: number; y?: number };
const node = (id: string): Node => ({ id });
const link = (type: string, source: string, target: string) => ({
  type,
  source,
  target,
});
const refines = (child: string, parent: string) =>
  link('istar.AndRefinementLink', child, parent);

const model = () => ({
  actors: [
    {
      ...node('A'),
      nodes: ['G1', 'G2', 'G3', 'T1', 'T2', 'Q1', 'S'].map(node),
    },
    { ...node('B'), nodes: ['G4', 'T3'].map(node) },
  ],
  // an extension's node: a kind of the model's own, linked by a link of its own
  orphans: [node('E')],
  dependencies: [node('D')],
  links: [
    refines('G2', 'G1'),
    refines('G3', 'G1'),
    link('istar.OrRefinementLink', 'T1', 'G2'),
    refines('T2', 'G2'),
    link('istar.ContributionLink', 'T1', 'Q1'),
    link('istar.ContributionLink', 'S', 'G3'),
    refines('T3', 'G4'),
    link('ext.Link', 'E', 'G4'),
    link('istar.DependencyLink', 'T3', 'D'),
    link('istar.DependencyLink', 'D', 'T2'),
  ],
});

const positions = (laidOut: ReturnType<typeof model>) =>
  Object.fromEntries(
    [
      ...laidOut.actors.flatMap((a) => [a, ...a.nodes]),
      ...laidOut.orphans,
      ...laidOut.dependencies,
    ].map((n: Node) => [n.id, [n.x, n.y]]),
  );

describe('layOut: a model without positions', () => {
  it('layers each actor by its refinements, the others beside what they link to', () => {
    const laidOut = model();
    const extent = layOut(laidOut);
    assert.deepStrictEqual(positions(laidOut), {
      // A: G1 over G2 and G3, G2 over T1 and T2; Q1 beside T1, S beside G3
      A: [40, 40],
      G1: [400, 80],
      G2: [240, 180],
      G3: [560, 180],
      S: [720, 180],
      T1: [80, 280],
      Q1: [240, 280],
      T2: [400, 280],
      // B beside A
      B: [920, 40],
      G4: [960, 80],
      T3: [960, 180],
      // outside both: beside B, in the row of what each first links to
      E: [1160, 80],
      D: [1160, 180],
    });
    assert.deepStrictEqual(extent, { right: 1320, bottom: 420 });
  });

  it('lays a model out the same way every time', () => {
    const [one, two] = [model(), model()];
    layOut(one);
    layOut(two);
    assert.deepStrictEqual(one, two);
  });

  it('keeps the positions a model has, and lays the others out from the origin', () => {
    const laidOut = model();
    Object.assign(laidOut.actors[1]!, { x: 5, y: 6 });
    for (const n of laidOut.actors[1]!.nodes) Object.assign(n, { x: 7, y: 8 });
    layOut(laidOut, { x: 0, y: 1000 });
    const at = positions(laidOut);
    assert.deepStrictEqual(
      [at.B, at.G4, at.T3],
      [
        [5, 6],
        [7, 8],
        [7, 8],
      ],
    );
    assert.deepStrictEqual(
      [at.A, at.G1],
      [
        [0, 1000],
        [360, 1040],
      ],
    );
    // linked to positioned nodes only, the extension's node is a root of its own
    assert.ok((at.E as number[])[0]! >= 920);
  });

  it('says there is nothing to lay out when every node has a position', () => {
    const placed: LayoutModel = {
      actors: [{ id: 'A', x: 0, y: 0, nodes: [{ id: 'G', x: 1, y: 2 }] }],
      orphans: [{ id: 'O', x: 3, y: 4 }],
    };
    assert.strictEqual(layOut(placed), null);
  });
});

/**
 * A mapper by kind (goal-controller#215): an entry per kind of the dialect,
 * or per group of kinds, each saying what the kinds are to the engine (`as`)
 * and mapping their properties; the iStar reading (`useIstarDefaultNaming`)
 * builds the trees a mapper written per role does, an own naming every
 * refinement child in `children`, and the IR gives every root, the
 * refinement graph and each element's kind as the engine names it.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { links, property } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  useIstarDefaultNaming,
  type EngineProps,
  type IStarModel,
  type LinkEntryFn,
  type NodeOf,
} from '../../src';

const dialect = {
  name: 'toy',
  properties: {
    goal: [
      property.int('maxRetries', { help: '' }),
      property.refList('dependsOn', 'goal', { help: '' }),
    ],
    task: [property.bool('optional', { help: '' })],
    resource: [property.number('initial', { help: '' })],
    quality: [property.text('note', { help: '' })],
    'toy.Sensor': [property.int('range', { help: '' })],
  },
  extension: {
    name: 'toy',
    elements: [{ kind: 'toy.Sensor', category: 'node' }],
  },
  links: links({
    'istar.ContributionLink': [property.int('weight', { help: '' })],
  }),
} as const;

const node = (
  id: string,
  text: string,
  type: string,
  customProperties: Record<string, string> = {},
) => ({ id, text, type, x: 0, y: 0, customProperties });

/** A goal refined by a goal and a Quality, the goal by a task needing a resource; a sensor beside them. */
const modelWith = (
  nodes: ReturnType<typeof node>[],
  linkList: Record<string, unknown>[],
): IStarModel =>
  parsePistar(
    {
      actors: [
        { id: 'a1', text: 'Lab', type: 'istar.Actor', x: 0, y: 0, nodes },
      ],
      orphans: [],
      dependencies: [],
      links: linkList,
      display: {},
      tool: 'pistar.2.1.0',
      istar: '2.0',
      saveDate: '',
      diagram: { width: 100, height: 100 },
      metamodel: {
        name: 'toy',
        elements: [{ kind: 'toy.Sensor', label: 'Sensor', category: 'node' }],
        links: [],
      },
    },
    { fileMetamodel: true },
  ) as unknown as IStarModel;

const MODEL = modelWith(
  [
    node('g1', 'G1: Root', 'istar.Goal', { maxRetries: '3', dependsOn: 'G2' }),
    node('g2', 'G2: Sub', 'istar.Goal'),
    node('t1', 'T1: Do', 'istar.Task', { optional: 'true' }),
    node('r1', 'R1: Stock', 'istar.Resource', { initial: '0.5' }),
    node('q1', 'G3: Fast', 'istar.Quality', { note: 'soon' }),
    node('s1', 'S1: Probe', 'toy.Sensor', { range: '5' }),
  ],
  [
    { id: 'l1', type: 'istar.AndRefinementLink', source: 'g2', target: 'g1' },
    { id: 'l2', type: 'istar.AndRefinementLink', source: 't1', target: 'g2' },
    { id: 'l3', type: 'istar.NeededByLink', source: 'r1', target: 't1' },
    { id: 'l4', type: 'istar.AndRefinementLink', source: 'q1', target: 'g1' },
    {
      id: 'l5',
      type: 'istar.ContributionLink',
      source: 't1',
      target: 'q1',
      label: 'help',
      customProperties: { weight: '50' },
    },
  ],
);

/** A node without what the iStar reading's entries add: its `kind`, and the roles' `isQuality`. */
const asRoles = (tree: unknown): unknown =>
  JSON.parse(
    JSON.stringify(tree, (key, value) =>
      key === 'kind' || key === 'isQuality' ? undefined : value,
    ),
  );

/** The toy's link entries: its contribution's weight. */
const LINKS = (entry: LinkEntryFn<typeof dialect>) => [
  entry({
    kind: 'istar.ContributionLink',
    mapProps: ({ props }) => ({ weight: props.weight ?? null }),
  }),
];

describe('a mapper by kind (#215)', () => {
  // the same mapping, written per role and with entries
  // a goal's and a Quality's (which has no maxRetries)
  const goal = ({ props }: { props: object }) => ({
    retries: (props as { maxRetries?: number | null }).maxRetries ?? 0,
  });
  const task = ({ props }: { props: { optional?: boolean | null } }) => ({
    optional: props.optional ?? false,
  });
  const resource = ({ props }: { props: { initial?: number | null } }) => ({
    initial: props.initial ?? 0,
  });
  const byRole = createEngineMapper<
    ReturnType<typeof goal>,
    ReturnType<typeof task>,
    ReturnType<typeof resource>
  >()({
    dialect,
    mapGoalProps: goal,
    mapTaskProps: task,
    mapResourceProps: resource,
    mapLinkProps: ({ props }) => ({ weight: props.weight ?? null }),
  });
  const byKind = createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: goal }),
      entry({ kind: 'istar.Task', mapProps: task }),
      entry({ kind: 'istar.Resource', mapProps: resource }),
      entry({
        kind: 'toy.Sensor',
        as: 'sensor',
        mapProps: ({ props }) => ({ range: props.range ?? 0 }),
      }),
    ],
    links: LINKS,
  });

  it('builds, under the iStar reading, the trees a mapper written per role does', () => {
    const roles = GoalTree.goalModel(MODEL, byRole);
    const kinds = GoalTree.goalModel(MODEL, byKind);
    assert.deepStrictEqual(
      asRoles(kinds.actors[0]!.trees),
      asRoles(roles.actors[0]!.trees),
    );
    // a link kind's entry maps it; one without (a refinement) has `{}`,
    // where a mapLinkProps maps every link
    assert.deepStrictEqual(
      kinds.links.find((link) => link.id === 'l5'),
      roles.links.find((link) => link.id === 'l5'),
    );
    assert.deepStrictEqual(
      kinds.links.find((link) => link.id === 'l1')?.properties,
      { engine: {} },
    );
    // every node says its kind; no isQuality
    const [root] = kinds.actors[0]!.trees;
    assert.strictEqual(root?.kind, 'istar.Goal');
    assert.ok(!('isQuality' in root!.properties));
    assert.deepStrictEqual(
      GoalTree.fromModel(MODEL, byKind)
        .query.allByType('goal')
        .map((goalNode) => [goalNode.id, goalNode.kind]),
      [
        ['G1', 'istar.Goal'],
        ['G2', 'istar.Goal'],
        ['G3', 'istar.Quality'],
      ],
    );
  });

  it("types each node's engine properties by its kind", () => {
    type Props = EngineProps<typeof byKind>;
    const sensor: Props['toy.Sensor'] = { range: 1 };
    // @ts-expect-error a sensor's output is its entry's, not a task's
    const wrong: Props['toy.Sensor'] = { optional: true };
    void [sensor, wrong];
    const nodes = GoalTree.fromModel(MODEL, byKind).nodes;
    const visit = (n: NodeOf<typeof byKind>): void => {
      if (n.type === 'task') {
        const optional: boolean = n.properties.engine.optional;
        void optional;
        n.resources.forEach(visit);
      }
      if (n.type === 'goal') {
        const retries: number = n.properties.engine.retries;
        void retries;
        n.tasks?.forEach(visit);
        n.children?.forEach(visit);
      }
    };
    nodes.forEach(visit);
  });

  it('gives an element of a kind no tree holds its `as` and its engine properties', () => {
    const { elements, actors } = GoalTree.goalModel(MODEL, byKind);
    assert.deepStrictEqual(
      elements.find((element) => element.id === 's1'),
      {
        id: 's1',
        kind: 'toy.Sensor',
        name: 'S1: Probe',
        actor: 'a1',
        properties: { range: '5' },
        as: 'sensor',
        engine: { range: 5 },
      },
    );
    // a tree kind's element has its `as`; its engine properties are on its node
    assert.deepStrictEqual(
      elements.find((element) => element.id === 'g1')?.as,
      'goal',
    );
    // the sensor is a root of no tree
    assert.deepStrictEqual(actors[0]!.roots, ['g1']);
  });

  it('exposes every root and the refinement graph', () => {
    const model = GoalTree.goalModel(MODEL, byKind);
    assert.deepStrictEqual(model.roots, ['g1']);
    assert.deepStrictEqual(model.refinements, [
      { link: 'l1', relation: 'and', parent: 'g1', child: 'g2' },
      { link: 'l2', relation: 'and', parent: 'g2', child: 't1' },
      { link: 'l3', relation: 'neededBy', parent: 't1', child: 'r1' },
      { link: 'l4', relation: 'and', parent: 'g1', child: 'q1' },
    ]);
  });

  it('leaves an ignored kind out of the trees, as skipResource does', () => {
    const ignoring = createEngineMapper({
      dialect,
      naming: useIstarDefaultNaming(),
      elements: (entry) => [
        entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: goal }),
        entry({ kind: 'istar.Task', mapProps: task }),
        entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
      ],
      ignore: ['istar.Resource'],
      links: LINKS,
    });
    const task1 = GoalTree.allByType(
      GoalTree.fromModel(MODEL, ignoring).nodes,
      'task',
    )[0];
    assert.deepStrictEqual(task1?.resources, []);
    // in the model's elements as written
    assert.deepStrictEqual(
      GoalTree.goalModel(MODEL, ignoring).elements.find((e) => e.id === 'r1'),
      {
        id: 'r1',
        kind: 'istar.Resource',
        name: 'R1: Stock',
        actor: 'a1',
        properties: { initial: '0.5' },
      },
    );
  });

  it("runs an entry's afterCreation once every node is built, children first", () => {
    const order: string[] = [];
    const resolving = createEngineMapper({
      dialect,
      naming: useIstarDefaultNaming(),
      elements: (entry) => [
        entry({
          kinds: ['istar.Goal', 'istar.Quality'],
          mapProps: () => ({ dependsOn: [] as string[] }),
          afterCreation: ({ node, input, allNodes }) => {
            order.push(node.id);
            const ids =
              input.kind === 'istar.Goal' ? (input.props.dependsOn ?? []) : [];
            return {
              dependsOn: ids.map((id) => allNodes.get(id)!.iStarId),
            };
          },
        }),
        entry({ kind: 'istar.Task', mapProps: task }),
        entry({ kind: 'istar.Resource', mapProps: resource }),
        entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
      ],
      links: LINKS,
    });
    const [root] = GoalTree.fromModel(MODEL, resolving).nodes;
    assert.ok(root?.type === 'goal');
    assert.deepStrictEqual(root.properties.engine, { dependsOn: ['g2'] });
    assert.deepStrictEqual(order, ['G2', 'G3', 'G1']);
  });

  it('applies the leaf-goal rule of the iStar reading, unless leaf goals are allowed', () => {
    const leaf = modelWith([node('g1', 'G1: Alone', 'istar.Goal')], []);
    const mapper = (leafGoals?: 'allow') =>
      createEngineMapper({
        dialect,
        naming: useIstarDefaultNaming(leafGoals ? { leafGoals } : {}),
        elements: (entry) => [
          entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: goal }),
          entry({ kind: 'istar.Task', mapProps: task }),
          entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
        ],
        ignore: ['istar.Resource'],
        links: LINKS,
      });
    assert.throws(
      () => GoalTree.fromModel(leaf, mapper()),
      /Leaf Goal G1:Alone has no children or tasks/,
    );
    assert.strictEqual(mapper().allowLeafGoals, false);
    assert.strictEqual(mapper('allow').allowLeafGoals, true);
    assert.strictEqual(
      GoalTree.fromModel(leaf, mapper('allow')).nodes.length,
      1,
    );
  });

  it('holds, under an own naming, every refinement child in `children`', () => {
    const own = createEngineMapper({
      dialect,
      elements: (entry) => [
        entry({
          kinds: ['istar.Goal', 'istar.Quality'],
          as: 'aim',
          mapProps: goal,
        }),
        entry({ kind: 'istar.Task', as: 'step', mapProps: task }),
        entry({ kind: 'istar.Resource', as: 'thing', mapProps: resource }),
        entry({
          kind: 'toy.Sensor',
          as: 'sensor',
          tree: false,
          mapProps: ({ props }) => ({ range: props.range ?? 0 }),
        }),
      ],
      links: LINKS,
    });
    const model = GoalTree.goalModel(MODEL, own);
    const [root] = model.actors[0]!.trees;
    const shape = (n: NodeOf<typeof own>): unknown => [
      n.id,
      n.type,
      n.children.map(shape),
    ];
    assert.deepStrictEqual(shape(root!), [
      'G1',
      'aim',
      [
        ['G2', 'aim', [['T1', 'step', [['R1', 'thing', []]]]]],
        ['G3', 'aim', []],
      ],
    ]);
    // @ts-expect-error no tasks outside the iStar reading
    void root!.tasks;
    assert.strictEqual(own.allowLeafGoals, true);
    assert.deepStrictEqual(
      model.elements.find((element) => element.id === 's1')?.engine,
      { range: 5 },
    );
  });

  it('throws for a kind in two entries', () => {
    assert.throws(
      () =>
        // @ts-expect-error 'kinds in two entries': "istar.Goal"
        createEngineMapper({
          dialect,
          naming: useIstarDefaultNaming(),
          elements: (entry) => [
            entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: goal }),
            entry({ kind: 'istar.Goal', mapProps: goal }),
            entry({ kind: 'istar.Task', mapProps: task }),
            entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
          ],
          ignore: ['istar.Resource'],
          links: LINKS,
        }),
      /istar.Goal is in two entries/,
    );
  });
});

/** Mappers that don't compile (never run): each line the error is on. */
export const compileErrors = () => [
  // a dialect kind without an entry, and not ignored
  // @ts-expect-error 'kinds without an entry': "istar.Resource"
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    links: LINKS,
  }),
  // @ts-expect-error (and the entry below: one error makes two)
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      // @ts-expect-error kaos.Softgoal is no kind of the dialect
      entry({ kinds: ['istar.Goal', 'kaos.Softgoal'], mapProps: () => ({}) }),
      entry({ kind: 'istar.Quality', mapProps: () => ({}) }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: LINKS,
  }),
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({
        kinds: ['istar.Goal', 'istar.Quality'],
        mapProps: (input) => {
          // @ts-expect-error a goal's key, before narrowing on its kind
          void input.props.maxRetries;
          if (input.kind === 'istar.Goal') void input.props.maxRetries;
          else void input.props.note;
          return {};
        },
      }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: LINKS,
  }),
  // @ts-expect-error (and the entry below: one error makes two)
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
      // @ts-expect-error the iStar reading names a task a task
      entry({ kind: 'istar.Task', as: 'goal', mapProps: () => ({}) }),
      // @ts-expect-error a kind the naming doesn't name needs its `as`
      entry({ kind: 'toy.Sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: LINKS,
  }),
  // @ts-expect-error (and the entry below: one error makes two)
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      // @ts-expect-error an ignored kind has no entry
      entry({ kind: 'istar.Resource', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: LINKS,
  }),
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({
        kinds: ['istar.Goal', 'istar.Quality'],
        mapProps: () => ({ n: 1 }),
        // @ts-expect-error afterCreation returns its entry's output
        afterCreation: () => ({ n: 'one' }),
      }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: LINKS,
  }),
  // a link kind the dialect gives properties, without an entry
  // @ts-expect-error 'link kinds without an entry': "istar.ContributionLink"
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
  }),
  createEngineMapper({
    dialect,
    naming: useIstarDefaultNaming(),
    elements: (entry) => [
      entry({ kinds: ['istar.Goal', 'istar.Quality'], mapProps: () => ({}) }),
      entry({ kind: 'istar.Task', mapProps: () => ({}) }),
      entry({ kind: 'toy.Sensor', as: 'sensor', mapProps: () => ({}) }),
    ],
    ignore: ['istar.Resource'],
    links: (entry) => [
      entry({ kind: 'istar.ContributionLink', mapProps: () => ({}) }),
      // @ts-expect-error not a link kind the dialect gives properties
      entry({ kind: 'istar.AndRefinementLink', mapProps: () => ({}) }),
    ],
  }),
];

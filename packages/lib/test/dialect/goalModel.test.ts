/**
 * The typed IR (goal-controller#125) on the toy dialect: actors holding one
 * tree per root goal, every link with its relation and mapped properties,
 * the actor and link mappers typed by the definition's keys, and the shape
 * an engine declares.
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { defineDialect } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  Model,
  modelShapeProblem,
  type GoalModel,
} from '@goal-controller/goal-tree';
import { toyGraph, toyMapper } from '../engines/analysis/toy';

const node = (id: string, type: string, text: string) => ({
  id,
  text,
  type: `istar.${type}`,
  x: 0,
  y: 0,
});
const link = (id: string, type: string, source: string, target: string) => ({
  id,
  type: `istar.${type}`,
  source,
  target,
});

/** Lab: G1 and G4, two roots; Robot: G2. T1 also helps G4, weighing 3. */
const FILE = {
  actors: [
    {
      ...node('a1', 'Actor', 'Lab'),
      customProperties: { budget: '5', note: 'not the toy’s' },
      nodes: [
        node('g1', 'Goal', 'G1: Analyse'),
        node('t1', 'Task', 'T1: Test'),
        node('g4', 'Goal', 'G4: Report'),
        node('t4', 'Task', 'T4: Write'),
      ],
    },
    {
      ...node('b1', 'Role', 'Robot'),
      nodes: [
        node('g2', 'Goal', 'G2: Deliver'),
        node('t2', 'Task', 'T2: Carry'),
      ],
    },
  ],
  orphans: [],
  dependencies: [],
  links: [
    link('l1', 'AndRefinementLink', 't1', 'g1'),
    link('l2', 'OrRefinementLink', 't4', 'g4'),
    link('l3', 'AndRefinementLink', 't2', 'g2'),
    {
      ...link('l4', 'ContributionLink', 't1', 'g4'),
      label: 'help',
      customProperties: { weight: '3' },
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: '',
  diagram: { width: 800, height: 600 },
};
const TWO_ACTORS = JSON.stringify(FILE);

const ids = (model: GoalModel) =>
  model.actors.map((actor) => [actor.name, actor.trees.map((tree) => tree.id)]);

describe('the typed IR (#125)', () => {
  it('two actors, two roots in one: an actor holds a tree per root goal, each node its actor', () => {
    const model = GoalTree.goalModel(parsePistar(TWO_ACTORS), toyMapper);
    expect(ids(model)).to.deep.equal([
      ['Lab', ['G1', 'G4']],
      ['Robot', ['G2']],
    ]);
    const [lab, robot] = model.actors;
    expect(lab!.kind).to.equal('istar.Actor');
    expect(robot!.kind).to.equal('istar.Role');
    expect(lab!.elements).to.deep.equal(['g1', 't1', 'g4', 't4']);
    // a contribution is a link of the model, not a child: T1 is G1's only
    const [g1, g4] = lab!.trees;
    expect(g1!.type === 'goal' && g1!.tasks?.map((t) => t.id)).to.deep.equal([
      'T1',
    ]);
    expect(g4!.type === 'goal' && g4!.tasks?.map((t) => t.id)).to.deep.equal([
      'T4',
    ]);
    expect(g1!.actor).to.equal('a1');
    expect(g1!.type === 'goal' && g1!.tasks![0]!.actor).to.equal('a1');
    expect(robot!.trees[0]!.actor).to.equal('b1');
    expect(g1!.type === 'goal' && g1!.properties.root).to.equal(true);
    // every link, its relation as a refinement reads it
    expect(
      model.links.map((l) => [l.id, l.relation, l.label ?? null]),
    ).to.deep.equal([
      ['l1', 'and', null],
      ['l2', 'or', null],
      ['l3', 'and', null],
      ['l4', null, 'help'],
    ]);
    expect(model.dependums).to.deep.equal([]);
    expect(model.elements.map((e) => [e.id, e.actor])).to.deep.equal([
      ['g1', 'a1'],
      ['t1', 'a1'],
      ['g4', 'a1'],
      ['t4', 'a1'],
      ['g2', 'b1'],
      ['t2', 'b1'],
    ]);
  });

  it('a dependum is a node outside every actor; fromModel maps none', () => {
    const withDependum = parsePistar(
      JSON.stringify({
        ...FILE,
        dependencies: [
          { ...node('d1', 'Goal', 'G9: Sample'), source: 't2', target: 'g1' },
        ],
        links: [
          ...FILE.links,
          link('l5', 'DependencyLink', 't2', 'd1'),
          link('l6', 'DependencyLink', 'd1', 'g1'),
        ],
      }),
    );
    const model = GoalTree.goalModel(withDependum, toyMapper);
    expect(model.dependums.map((d) => [d.id, d.actor])).to.deep.equal([
      ['G9', undefined],
    ]);
    expect(model.elements.find((e) => e.id === 'd1')).to.deep.equal({
      id: 'd1',
      kind: 'istar.Goal',
      name: 'G9: Sample',
      properties: {},
    });
    // a dependency is a link, no refinement: the trees are as without it
    expect(ids(model)).to.deep.equal([
      ['Lab', ['G1', 'G4']],
      ['Robot', ['G2']],
    ]);
    const any = {
      ...toyMapper,
      dialect: {
        ...toyGraph,
        model: { actors: 'many', treesPerActor: 'many' } as const,
      },
    };
    expect(
      GoalTree.fromModel(withDependum, any).nodes.map((n) => n.id),
    ).to.deep.equal(['G1', 'G4', 'G2']);
  });

  it('actor and link properties reach their mappers, typed by the definition’s keys', () => {
    const seen: string[] = [];
    const mapper = createEngineMapper<object, object, never>()({
      dialect: toyGraph,
      skipResource: true,
      allowLeafGoals: true,
      mapGoalProps: () => ({}),
      mapTaskProps: () => ({}),
      mapActorProps: ({ raw, kind, id, name }) => {
        seen.push(`${kind} ${id} ${name}`);
        // @ts-expect-error: the toy's actors have a budget only
        void raw.note;
        return { budget: raw.budget === undefined ? null : Number(raw.budget) };
      },
      mapLinkProps: ({ raw }) => ({
        // @ts-expect-error: the toy's links have a weight only
        other: raw.budget,
        weight: raw.weight === undefined ? 0 : Number(raw.weight),
      }),
    });
    const model = GoalTree.goalModel(parsePistar(TWO_ACTORS), mapper);
    const budgets: Array<number | null> = model.actors.map(
      (actor) => actor.properties.engine.budget,
    );
    expect(budgets).to.deep.equal([5, null]);
    expect(seen).to.deep.equal(['istar.Actor a1 Lab', 'istar.Role b1 Robot']);
    const weights: number[] = model.links.map(
      (l) => l.properties.engine.weight,
    );
    expect(weights).to.deep.equal([0, 0, 0, 3]);
  });

  it('without the mappers an actor and a link map to {}', () => {
    const mapper = createEngineMapper<object, object, never>()({
      dialect: toyGraph,
      skipResource: true,
      allowLeafGoals: true,
      mapGoalProps: () => ({}),
      mapTaskProps: () => ({}),
    });
    const model = GoalTree.goalModel(parsePistar(TWO_ACTORS), mapper);
    expect(model.actors.map((a) => a.properties.engine)).to.deep.equal([
      {},
      {},
    ]);
    expect(model.links.map((l) => l.properties.engine)).to.deep.equal([
      {},
      {},
      {},
      {},
    ]);
  });

  it('afterCreation sees the whole GoalModel', () => {
    const actorsSeen: number[] = [];
    const mapper = createEngineMapper<object, object, never>()({
      dialect: toyGraph,
      skipResource: true,
      allowLeafGoals: true,
      mapGoalProps: () => ({}),
      mapTaskProps: () => ({}),
      afterCreationMapper: ({ node, model }) => {
        actorsSeen.push(model.actors.length);
        return node.properties.engine;
      },
    });
    GoalTree.goalModel(parsePistar(TWO_ACTORS), mapper);
    // once per goal: G1, G4, G2
    expect(actorsSeen).to.deep.equal([2, 2, 2]);
  });

  describe('the shape an engine reads', () => {
    const model = () => parsePistar(TWO_ACTORS);
    const robotOnly = () =>
      parsePistar(
        JSON.stringify({
          ...FILE,
          actors: [FILE.actors[1]],
          links: FILE.links.filter((l) => l.id === 'l3'),
        }),
      );

    it('by default one actor with one root goal: the rest is a problem, thrown before generation', () => {
      expect(modelShapeProblem(model(), toyGraph)).to.equal(
        'Toy graph reads one actor with one root goal; the model has 2 actors',
      );
      expect(() => GoalTree.fromModel(model(), toyMapper)).to.throw(
        '[INVALID_MODEL]: Toy graph reads one actor with one root goal; the model has 2 actors',
      );
      expect(() => Model.validate(model(), toyGraph)).to.throw(
        '[INVALID_MODEL]: Toy graph reads one actor with one root goal; the model has 2 actors',
      );
      expect(modelShapeProblem(robotOnly(), toyGraph)).to.equal(null);
      expect(
        GoalTree.fromModel(robotOnly(), toyMapper).nodes.map((n) => n.id),
      ).to.deep.equal(['G2']);
    });

    it('one root goal per actor: an actor with two is the problem', () => {
      const perActor = {
        ...toyGraph,
        model: { actors: 'many', treesPerActor: 'one' } as const,
      };
      expect(modelShapeProblem(model(), perActor)).to.equal(
        'Toy graph reads one root goal per actor; actor "Lab" has 2 root goals (G1, G4)',
      );
    });

    it('many actors with many roots: any model, its trees flat from fromModel', () => {
      const any = {
        ...toyGraph,
        model: { actors: 'many', treesPerActor: 'many' } as const,
      };
      expect(modelShapeProblem(model(), any)).to.equal(null);
      const mapper = { ...toyMapper, dialect: any };
      expect(
        GoalTree.fromModel(model(), mapper).nodes.map((n) => n.id),
      ).to.deep.equal(['G1', 'G4', 'G2']);
    });

    it('a definition’s shape is one or many', () => {
      expect(() =>
        defineDialect({
          ...toyGraph,
          id: 'badshape',
          // @ts-expect-error: not a shape
          model: { actors: 'two', treesPerActor: 'one' },
        }),
      ).to.throw('model.actors: one or many, not two');
    });
  });
});

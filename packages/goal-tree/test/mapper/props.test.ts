/**
 * What a mapper is given (goal-controller#187): the properties the dialect
 * gives the element's, the actor's or the link's kind, read as their types
 * (`props`) and as written (`raw`); a value with an error unset.
 */
import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { actors, links, property } from '@goal-controller/dialect';
import { createEngineMapper, GoalTree, type GoalNode } from '../../src';

const dialect = {
  name: 'toy',
  properties: {
    goal: [
      property.int('maxRetries', { help: '' }),
      property.enum('type', ['achieve', 'maintain'], { help: '' }),
      property.refList('dependsOn', 'goal', { help: '' }),
    ],
    task: [property.bool('optional', { help: '' })],
    resource: [property.number('initial', { help: '' })],
    quality: [property.text('note', { help: '' })],
  },
  actors: actors([property.int('budget', { help: '' })]),
  links: links({
    'istar.AndRefinementLink': [property.int('weight', { help: '' })],
  }),
};

type Seen = Record<string, unknown>;

const MODEL = parsePistar({
  actors: [
    {
      id: 'a1',
      text: 'Lab',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      customProperties: { budget: '5', other: 'x' },
      nodes: [
        {
          id: 'g1',
          text: 'G1: Root',
          type: 'istar.Goal',
          x: 0,
          y: 0,
          customProperties: {
            maxRetries: '3',
            type: 'perform',
            dependsOn: 'G2',
            optional: 'true',
          },
        },
        {
          id: 't1',
          text: 'T1: Do',
          type: 'istar.Task',
          x: 0,
          y: 0,
          customProperties: { optional: 'true', maxRetries: '1' },
        },
        {
          id: 'r1',
          text: 'R1: Stock',
          type: 'istar.Resource',
          x: 0,
          y: 0,
          customProperties: { initial: '0.5' },
        },
        {
          id: 'q1',
          text: 'G3: Fast',
          type: 'istar.Quality',
          x: 0,
          y: 0,
          customProperties: { note: 'soon', maxRetries: '2' },
        },
      ],
    },
  ],
  orphans: [],
  dependencies: [],
  links: [
    {
      id: 'l1',
      type: 'istar.AndRefinementLink',
      source: 't1',
      target: 'g1',
      customProperties: { weight: '50' },
    },
    {
      id: 'l2',
      type: 'istar.AndRefinementLink',
      source: 'r1',
      target: 't1',
    },
    {
      id: 'l3',
      type: 'istar.AndRefinementLink',
      source: 'q1',
      target: 'g1',
    },
    {
      id: 'l4',
      type: 'istar.QualificationLink',
      source: 'q1',
      target: 't1',
      customProperties: { weight: '1' },
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: '',
  diagram: { width: 100, height: 100 },
});

describe('mapper props (#187)', () => {
  const seen: Seen = {};
  const mapper = createEngineMapper<Seen, Seen, Seen>()({
    dialect,
    allowLeafGoals: true,
    mapGoalProps: ({ props, raw, kind }) => {
      // the goal kinds' keys (a Quality's too), typed
      const retries: number | null | undefined = props.maxRetries;
      const type: 'achieve' | 'maintain' | null | undefined = props.type;
      const dependsOn: string[] | undefined = props.dependsOn;
      // @ts-expect-error a task's key
      void props.optional;
      seen[kind] = { props, raw, retries, type, dependsOn };
      return {};
    },
    mapTaskProps: ({ props, raw }) => {
      const optional: boolean | null | undefined = props.optional;
      seen.task = { props, raw, optional };
      return {};
    },
    mapResourceProps: ({ props, raw, id }) => {
      const initial: number | null | undefined = props.initial;
      seen.resource = { props, raw, id, initial };
      return {};
    },
    mapActorProps: ({ props, raw }) => {
      const budget: number | null | undefined = props.budget;
      seen.actor = { props, raw, budget };
      return {};
    },
    mapLinkProps: ({ props, raw, id }) => {
      const weight: number | null | undefined = props.weight;
      seen[id] = { props, raw, weight };
      return {};
    },
    afterCreationMapper: ({ node, rawProperties }) => {
      if (rawProperties.nodeType === 'goal')
        seen.after = { kind: rawProperties.kind, props: rawProperties.props };
      return node.properties.engine;
    },
  });
  before(() => GoalTree.goalModel(MODEL, mapper));

  it("gives a goal its kind's properties, a value with an error unset", () => {
    // #270: changed (dependsOn was ['G2']): the model has no G2, so the
    // refList names no element and is unset, as the dialect reports it
    assert.deepStrictEqual(seen['istar.Goal'], {
      props: { maxRetries: 3 },
      raw: { maxRetries: '3', type: 'perform', dependsOn: 'G2' },
      retries: 3,
      type: undefined,
      dependsOn: undefined,
    });
    assert.deepStrictEqual(seen.after, {
      kind: 'istar.Goal',
      props: { maxRetries: 3 },
    });
  });

  it('gives a quality, a task and a resource theirs', () => {
    assert.deepStrictEqual((seen['istar.Quality'] as Seen).raw, {
      note: 'soon',
    });
    assert.deepStrictEqual(seen.task, {
      props: { optional: true },
      raw: { optional: 'true' },
      optional: true,
    });
    assert.deepStrictEqual(seen.resource, {
      props: { initial: 0.5 },
      raw: { initial: '0.5' },
      id: 'R1',
      initial: 0.5,
    });
  });

  it("gives an actor the dialect's actor properties, a link its kind's typed and every kind's as written", () => {
    assert.deepStrictEqual(seen.actor, {
      props: { budget: 5 },
      raw: { budget: '5' },
      budget: 5,
    });
    assert.deepStrictEqual(seen.l1, {
      props: { weight: 50 },
      raw: { weight: '50' },
      weight: 50,
    });
    // a qualification has no properties in the dialect: its weight is
    // typed on no kind, kept as written for a check to report
    assert.deepStrictEqual(seen.l4, {
      props: {},
      raw: { weight: '1' },
      weight: undefined,
    });
  });

  it('types a node of a tree by what its mapper gives', () => {
    const tree = GoalTree.fromModel(MODEL, mapper);
    const root: GoalNode<Seen, Seen, Seen> | undefined = tree.nodes[0] as
      | GoalNode<Seen, Seen, Seen>
      | undefined;
    assert.strictEqual(root?.id, 'G1');
  });
});

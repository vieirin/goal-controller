/**
 * The GoalTree IR of a framework besides iStar 2.0 (goal-controller#171), on
 * DSM3's seeds: trees on the paper, one per element no refinement makes a
 * child; KAOS's hubs as AND refinements with their legs' children; a node's
 * kind kept, its piStar id its id when its text gives none; keys by kind.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar, type AnyMetamodel } from '@istar-ts/core';
import { KAOS } from '@istar-ts/dsm3-kaos/metamodel';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import { propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  modelShapeProblem,
  type GoalNode,
  type IStarModel,
  type TreeNode,
} from '@goal-controller/goal-tree';
import { kaos, nfr } from '../../src';

const seed = (path: string) =>
  readFileSync(join(__dirname, '../../../../examples', path), 'utf8');
/** A model read with its framework's root, typed as the IR takes it (an iStar model). */
const read = (text: string, metamodel: AnyMetamodel) =>
  parsePistar(text, { metamodel }) as unknown as IStarModel;
const KAOS_MODEL = read(seed('kaos/kaos-welcome.txt'), KAOS);
const NFR_MODEL = read(seed('nfr/nfr-welcome.txt'), NFR);

type Props = { kind: string; raw: Record<string, string | undefined> };
const mapperOf = (dialect: typeof kaos | typeof nfr) =>
  createEngineMapper<Props, never>()({
    dialect,
    skipResource: true,
    mapGoalProps: ({ raw, kind }) => ({ kind, raw }),
    mapTaskProps: () => {
      throw new Error('no task');
    },
  });
const KAOS_MAPPER = mapperOf(kaos);
const NFR_MAPPER = mapperOf(nfr);

/** A tree as `name (kind) [relation]: children`, for comparison. */
const shape = (node: TreeNode<Props>): unknown => {
  const goal = node as GoalNode<Props>;
  return {
    [`${goal.name} (${goal.kind})`]: (goal.children ?? []).map(shape),
    ...(goal.children?.length && { relation: goal.relationToChildren }),
  };
};

describe('the IR of a framework besides iStar 2.0 (#171)', () => {
  it("reads KAOS's model on the paper, a hub an AND with its legs' children", () => {
    expect(modelShapeProblem(KAOS_MODEL, kaos)).to.equal(null);
    const model = GoalTree.goalModel(KAOS_MODEL, KAOS_MAPPER);
    expect(model.actors).to.deep.equal([]);
    expect(model.paper.map(shape)).to.deep.equal([
      {
        'Reliability (kaos.Softgoal)': [
          { 'Achieve [Problem Notified if Problem] (kaos.BehavioralGoal)': [] },
          {
            'Backup (kaos.Softgoal)': [
              {
                'Maintain [Minimal Interval Between Automatic Backups] (kaos.BehavioralGoal)':
                  [
                    {
                      'Internet connection available (kaos.DomainProperty)': [],
                    },
                  ],
                relation: 'and',
              },
              { 'Achieve [Manual Backup] (kaos.BehavioralGoal)': [] },
            ],
            relation: 'and',
          },
        ],
        relation: 'and',
      },
      { 'Save Bandwidth (kaos.Softgoal)': [] },
    ]);
    // the trees flat, as a one-file engine reads them
    expect(GoalTree.fromModel(KAOS_MODEL, KAOS_MAPPER).nodes).to.deep.equal(
      model.paper,
    );
  });

  it('keeps a node its piStar id when its text gives none, and reads the id a text gives', () => {
    const [reliability] = GoalTree.goalModel(KAOS_MODEL, KAOS_MAPPER).paper;
    expect(reliability).to.include({
      id: '7857cb00-05ce-4bd0-aa89-3c7a63b54b31',
      iStarId: '7857cb00-05ce-4bd0-aa89-3c7a63b54b31',
      name: 'Reliability',
      kind: 'kaos.Softgoal',
    });
    const text = seed('kaos/kaos-welcome.txt').replace(
      '"Reliability"',
      '"G1: Reliability"',
    );
    const [named] = GoalTree.goalModel(read(text, KAOS), KAOS_MAPPER).paper;
    expect(named).to.include({ id: 'G1', name: 'Reliability' });
  });

  it("reads each kind's keys in the dialect, and gives the mapper the kind", () => {
    const model = GoalTree.goalModel(KAOS_MODEL, KAOS_MAPPER);
    const nodes = GoalTree.allByType(model.paper, 'goal');
    const property = nodes.find((n) => n.kind === 'kaos.DomainProperty')!
      .properties.engine;
    expect(property).to.deep.equal({
      kind: 'kaos.DomainProperty',
      raw: { Description: '' },
    });
    const goal = nodes.find((n) => n.name === 'Achieve [Manual Backup]')!;
    expect(Object.keys(goal.properties.engine.raw)).to.include.members([
      'FitCriterion',
      'FormalSpec',
    ]);
    expect(propertyKeys(kaos, 'kaos.BehavioralGoal')).to.include.members(
      Object.keys(goal.properties.engine.raw),
    );
  });

  it('lists every link, a leg with its refinement, and the agents and hubs as elements', () => {
    const model = GoalTree.goalModel(KAOS_MODEL, KAOS_MAPPER);
    const relations = Object.fromEntries(
      model.links.map((link) => [link.kind, link.relation]),
    );
    expect(relations).to.deep.equal({
      'kaos.RefinementLinkStart': 'and',
      'kaos.RefinementLinkEnd': null,
      'kaos.Conflict': null,
      'kaos.ResponsibilityAssignment': null,
    });
    expect(
      model.elements.filter((e) => e.kind !== 'kaos.RefinementLinkHub').length,
    ).to.equal(8);
    expect(
      model.elements.filter((e) => e.kind === 'kaos.RefinementLinkHub').length,
    ).to.equal(4);
  });

  it("reads NFR's refinements, and leaves claims to the model's elements", () => {
    const model = GoalTree.goalModel(NFR_MODEL, NFR_MAPPER);
    expect(model.paper.map(shape)).to.deep.equal([
      {
        'Security (nfr.NFR)': [
          { 'Confidenciality (nfr.NFR)': [] },
          { 'Authentication (nfr.NFR)': [] },
        ],
        relation: 'and',
      },
      { 'Encrypt with RSA 128 bits (nfr.Operationalization)': [] },
      { 'Encrypt with RSA 260 bits (nfr.Operationalization)': [] },
      { 'Usability (nfr.NFR)': [] },
      { 'Login with Username and Password (nfr.Operationalization)': [] },
      { 'Example of a big, colored NFR (nfr.NFR)': [] },
    ]);
    expect(
      model.links.find((link) => link.kind === 'nfr.ContributionLink'),
    ).to.include({ relation: null, label: '+' });
    expect(model.elements.map((e) => e.kind)).to.include('nfr.Claim');
  });

  it('builds the iStar IR as before: no tree on the paper', () => {
    const istar = parsePistar(seed('edgeV2/simpleChoice.txt')) as IStarModel;
    const model = GoalTree.goalModel(
      istar,
      createEngineMapper<unknown, unknown>()({
        dialect: { name: 'plain' },
        skipResource: true,
        mapGoalProps: () => ({}),
        mapTaskProps: () => ({}),
      }),
    );
    expect(model.paper).to.deep.equal([]);
    expect(model.actors[0]!.trees[0]).not.to.have.property('kind');
  });
});

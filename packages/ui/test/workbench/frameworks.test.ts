/**
 * The frameworks a model may be in (goal-controller#171): each read with an
 * istar-ts root, iStar 2.0's, KAOS's or NFR's; the dialect package's kind
 * table read from those roots.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  ISTAR_2_0,
  metamodelOf,
  toPistar,
} from '@istar-ts/core';
import {
  KAOS_OBSTACLES,
  KAOS_REFINEMENT_HUB,
} from '@istar-ts/dsm3-kaos/metamodel';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import {
  defineExtension,
  extensionHubKinds,
  extensionLinkKinds,
  FRAMEWORK_KINDS,
  FRAMEWORKS,
} from '@goal-controller/dialect';
import { istar4RationalAgents } from '@goal-controller/lib';
import { recordedFramework, withModelSettings } from '@/lib/project';
import {
  emptyModelText,
  FRAMEWORK_ROOTS,
  hostFor,
} from '@/lib/workbench/frameworks';
import { metamodelOfMode, parseModel } from '@/lib/workbench/dialects';
import { EMPTY_PISTAR_MODEL } from '@/lib/workbench/pistar';
import { GoalModel } from '@/services/goalModel';

/** DSM3-goals' own KAOS example (istar-ts fixtures/dsm3), as DSM3 saves it. */
const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);

/** A KAOS model as DSM3 writes it: a goal AND-refined by another, through its hub. */
const KAOS_MODEL = JSON.stringify({
  actors: [],
  orphans: [
    { id: 'g1', text: 'Reliability', type: 'kaos.Softgoal', x: 10, y: 10 },
    { id: 'g2', text: 'Backups', type: 'kaos.BehavioralGoal', x: 10, y: 90 },
  ],
  dependencies: [],
  links: [
    {
      hub: { id: 'h', type: KAOS_REFINEMENT_HUB, x: 10, y: 50 },
      starts: [
        {
          id: 's',
          type: 'kaos.RefinementLinkStart',
          source: 'g2',
          target: 'h',
        },
      ],
      end: {
        id: 'e',
        type: 'kaos.RefinementLinkEnd',
        source: 'h',
        target: 'g1',
      },
    },
  ],
  display: {},
  tool: 'dsm3-goals',
  metamodelVersion: '1.0',
  saveDate: '',
  diagram: { width: 800, height: 600 },
});

describe('frameworks', () => {
  it('has a root for each framework, whose framework it is', () => {
    for (const framework of FRAMEWORKS)
      expect(FRAMEWORK_ROOTS[framework].framework).toBe(framework);
    expect(FRAMEWORK_ROOTS['istar-2.0']).toBe(ISTAR_2_0);
  });

  it("reads the dialect's kind table from the roots the workbench reads models with (#181)", () => {
    for (const framework of ['kaos', 'nfr'] as const) {
      const root = FRAMEWORK_ROOTS[framework];
      expect(FRAMEWORK_KINDS[framework].elements, framework).toEqual([
        ...root.elements.keys(),
      ]);
      expect(FRAMEWORK_KINDS[framework].links, framework).toEqual([
        ...root.links.keys(),
      ]);
    }
    // KAOS's, with its obstacle analysis
    expect(FRAMEWORK_KINDS.kaos.elements).toContain('kaosObstacles.Obstacle');
  });

  it("hosts a dialect on its framework's root", () => {
    expect(hostFor('kaos')).toBe(KAOS_OBSTACLES);
    const host = hostFor('istar-2.0', istar4RationalAgents);
    expect(host.framework).toBe('istar-2.0');
    expect(host.elements.has('istar.Goal')).toBe(true);
    expect(
      istar4RationalAgents.elements!.every(({ kind }) =>
        host.elements.has(kind),
      ),
    ).toBe(true);
  });

  it("hosts a framework dialect's extension on its root: kinds, an n-ary link's hub and legs (#181)", () => {
    const voting = defineExtension(
      {
        name: 'vote',
        label: 'Voting',
        elements: [{ kind: 'vote.Ballot', category: 'node' }],
        links: [
          {
            kind: 'vote.TallyLink',
            arity: 'n',
            rules: {
              sources: ['kaos.BehavioralGoal'],
              targets: ['vote.Ballot'],
            },
          },
        ],
        groupers: {},
        stereotypes: [],
        taggedValues: [],
        defaultTags: [],
      },
      undefined,
      'kaos',
    );
    const host = hostFor('kaos', voting);
    expect(host.framework).toBe('kaos');
    expect(host.elements.has('kaos.BehavioralGoal')).toBe(true);
    expect(host.elements.has('vote.Ballot')).toBe(true);
    // the kinds istar-ts generates, by the names the dialect gives properties
    expect(host.elements.has('vote.TallyLinkHub')).toBe(true);
    for (const kind of extensionLinkKinds(voting))
      expect(host.links.has(kind), kind).toBe(true);
    expect(extensionHubKinds(voting)).toEqual(['vote.TallyLinkHub']);
  });

  it('writes a new iStar model as it always did, and records another framework', () => {
    expect(emptyModelText('istar-2.0')).toBe(EMPTY_PISTAR_MODEL);
    expect(EMPTY_PISTAR_MODEL).toBe(
      `${toPistar(createEmptyModel(), { saveDate: '' })}\n`,
    );
    expect(recordedFramework(EMPTY_PISTAR_MODEL)).toBe(null);
    for (const framework of ['kaos', 'nfr'] as const) {
      const text = emptyModelText(framework);
      expect(recordedFramework(text)).toBe(framework);
      expect(JSON.parse(text).tool).toBe('dsm3-goals');
      expect(metamodelOf(parseModel(text)).framework).toBe(framework);
    }
  });

  it('reads a model with the root of its framework: its content, its record, or the one given', () => {
    // iStar 2.0 has no kaos kinds
    expect(() => parseModel(KAOS_MODEL, null, 'istar-2.0')).toThrow();
    const recorded = withModelSettings(KAOS_MODEL, { framework: 'kaos' });
    for (const model of [
      parseModel(KAOS_MODEL),
      parseModel(recorded),
      parseModel(KAOS_MODEL, null, 'kaos'),
    ]) {
      expect(metamodelOf(model).framework).toBe('kaos');
      expect(model.elements.get('g2')?.kind).toBe('kaos.BehavioralGoal');
      expect(model.elements.get('h')?.kind).toBe(KAOS_REFINEMENT_HUB);
    }
    expect(metamodelOfMode(null, recorded)).toBe(KAOS_OBSTACLES);
    expect(metamodelOfMode(null, KAOS_MODEL)).toBe(KAOS_OBSTACLES);
    expect(metamodelOfMode(null, KAOS_MODEL, 'nfr')).toBe(NFR);
    expect(metamodelOfMode(null, EMPTY_PISTAR_MODEL)).toBe(ISTAR_2_0);
  });

  it("opens DSM3's KAOS welcome model, which records no framework, as KAOS", () => {
    expect(recordedFramework(KAOS_WELCOME)).toBe(null);
    const model = parseModel(KAOS_WELCOME);
    expect(metamodelOf(model).framework).toBe('kaos');
    expect(
      [...model.elements.values()].filter(
        (e) => (e.kind as string) === KAOS_REFINEMENT_HUB,
      ),
    ).toHaveLength(4);
    // the goal model service reads it in KAOS too: what fails is the IR's (PR D)
    const read = GoalModel.parseModel(KAOS_WELCOME);
    expect(read.success === false && read.stage).not.toBe('parse');
  });
});

describe('the IR of a framework model, read by the workbench (#171)', () => {
  // the workbench parses with core's ESM build, goal-tree reads with its
  // CommonJS one: hubs are found by their kinds, not core's registry
  it("reads DSM3's KAOS model with its hubs as AND refinements", async () => {
    const { GoalTree, createEngineMapper } =
      await import('@goal-controller/goal-tree');
    const { kaos } = await import('@goal-controller/lib');
    const model = GoalTree.goalModel(
      parseModel(KAOS_WELCOME) as never,
      createEngineMapper({
        dialect: kaos,
        elements: (entry) => [
          entry({
            kinds: [
              'kaos.BehavioralGoal',
              'kaos.Softgoal',
              'kaos.DomainProperty',
              'kaosObstacles.Obstacle',
            ],
            as: 'goal',
            mapProps: () => ({}),
          }),
        ],
        ignore: [
          'kaos.Agent',
          'kaos.EnvironmentAgent',
          'kaos.RefinementLinkHub',
        ],
        links: (entry) => [
          entry({
            kinds: ['kaos.Conflict', 'kaosObstacles.ResolutionLink'],
            mapProps: () => ({}),
          }),
        ],
      }),
    );
    expect(model.paper.map((tree) => tree.name)).toEqual([
      'Reliability',
      'Save Bandwidth',
    ]);
    expect(model.paper[0]!.relationToChildren).toBe('and');
    expect(
      GoalTree.allByType(model.paper, 'goal').map((node) => node.name),
    ).not.toContain('');
    expect(GoalTree.allByType(model.paper, 'goal')).toHaveLength(7);
  });
});

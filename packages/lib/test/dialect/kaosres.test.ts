/**
 * kaosres's transformations on the literature's models (goal-controller#202,
 * #191 part A): ADS's resolutions over its London Ambulance model
 * (`resolvedby(prevention)`, `resolvedby(mitigation[…])`, restoration,
 * weakening), KAOSTools' LAS and the Respect-IT tutorial's Elevator. The
 * oracle is #202's, with no numbers: each transformed model has no Problem
 * the `kaos` dialect didn't find before, the obstacle no longer obstructs
 * where its countermeasure is integrated under RE'12 propagation (with the
 * obstacle alone at probability 1 that goal's EPS is what it is at 0), and
 * kaosdoc prints the resolution in its Obstacles section.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { inheritMetamodel, parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { kaos } from '../../src';
import { readKaos } from '../../src/importers/kaos';
import { propagateProbabilities } from '../../src/engines/kaosprop';
import { kaosdocDocument, kaosdocGoalModel } from '../../src/engines/kaosdoc';
import {
  applyCountermeasures,
  countermeasuresOf,
  integrationOf,
  kaosresView,
  obstructs,
  type Countermeasure,
  type KaosModel,
  type ResolutionStrategy,
} from '../../src/engines/kaosres';
import { frameworkProblems } from '../../../ui/lib/workbench/frameworkProblems';

const corpus = (path: string) =>
  readFileSync(
    join(__dirname, '../../../goal-language/test/fixtures/kaos', path),
    'utf8',
  );
// `files` is open: a project's files by path, as readKaos takes them
const read = (text: string, files?: Readonly<Record<string, string>>) => {
  const { model, diagnostics } = readKaos(text, { modelName: 'm', files });
  expect(model, JSON.stringify(diagnostics.slice(0, 3))).to.not.equal(null);
  return parsePistar(model!, { metamodel: KAOS_OBSTACLES });
};

type Node = { id: string; type: string };
type Link =
  | { type: string; source: string; target: string }
  | { hub: Node; starts: unknown[]; end: unknown };
type Model = { orphans: Node[]; links: Link[]; actors: unknown[] };

/**
 * `KAOS_OBSTACLES`'s own kinds (dsm3-kaos's `KAOS_ELEMENT_KINDS`,
 * `KAOS_OBSTACLE_ELEMENT_KINDS`, saved as `kaos.*`): the goal and obstacle
 * models. The seed's operation and object models (goal-controller#210) add
 * kinds this metamodel doesn't know (`kaos.Entity`, `kaos.Operation`, …);
 * filtering them out here, by kind, is how the seed can be the one copy of
 * the §3.6 declarations (rv400's review of #400), with no separate fixture.
 */
const KAOS_OBSTACLES_ELEMENT_KINDS = new Set([
  'kaos.BehavioralGoal',
  'kaos.Softgoal',
  'kaos.Agent',
  'kaos.EnvironmentAgent',
  'kaos.DomainProperty',
  'kaos.Obstacle',
]);
const KAOS_OBSTACLES_LINK_KINDS = new Set([
  'kaos.ResponsibilityAssignment',
  'kaos.Conflict',
  'kaos.ObstructionLink',
  'kaos.ResolutionLink',
]);
const kaosObstacleModelOf = (model: Model): Model => ({
  ...model,
  orphans: model.orphans.filter((n) =>
    KAOS_OBSTACLES_ELEMENT_KINDS.has(n.type),
  ),
  links: model.links.filter((l) =>
    'hub' in l ? true : KAOS_OBSTACLES_LINK_KINDS.has(l.type),
  ),
});

/** ADS's London Ambulance with its obstacles and its resolutions (las.kaos imports both). */
const ADS = read(corpus('ads/las.kaos'), {
  'obstacles.kaos': corpus('ads/obstacles.kaos'),
  'resolutions.kaos': corpus('ads/resolutions.kaos'),
});
const LAS = read(corpus('kaostools/las.kaos'));
// the seed's own file (goal-controller#210): its §3.6 obstacle analysis
// (#202) is the only copy, no separate fixture (rv400's review of #400)
const ELEVATOR = (() => {
  const text = readFileSync(
    join(__dirname, '../../../../examples/kaos/elevator/elevator.kaos'),
    'utf8',
  );
  const { model, diagnostics } = readKaos(text, { modelName: 'm' });
  expect(model, JSON.stringify(diagnostics.slice(0, 3))).to.not.equal(null);
  return parsePistar(kaosObstacleModelOf(model! as Model), {
    metamodel: KAOS_OBSTACLES,
  });
})();

/** The model with `obstacle` a leaf at probability `p`: its refinements gone, its estimates too. */
const alone = (model: KaosModel, obstacle: string, p: number): KaosModel => {
  const hubs = new Set(
    [...model.links.values()]
      .filter(
        (l) =>
          l.kind === 'kaosObstacles.ObstacleRefinementLinkEnd' &&
          l.target === obstacle,
      )
      .map((l) => l.source),
  );
  const element = model.elements.get(obstacle)!;
  const elements = new Map([...model.elements].filter(([id]) => !hubs.has(id)));
  elements.set(obstacle, {
    ...element,
    customProperties: {
      ...Object.fromEntries(
        Object.entries(element.customProperties ?? {}).filter(
          ([key]) => !key.startsWith('Probability'),
        ),
      ),
      Probability: String(p),
    },
  });
  return inheritMetamodel(model, {
    ...model,
    elements,
    links: new Map(
      [...model.links].filter(
        ([, l]) => !hubs.has(l.source) && !hubs.has(l.target),
      ),
    ),
  });
};

const eps = (model: KaosModel, goal: string) =>
  propagateProbabilities(kaosresView(model)).probabilities.get(goal)!;

/** Problems as the `kaos` dialect says them, one line each. */
const problems = (model: KaosModel) =>
  frameworkProblems(model, kaos).map(
    (p) => `${p.severity} ${p.code}: ${p.message}`,
  );

/**
 * One countermeasure applied, where it is integrated (its anchor for the
 * anchoring and substitution schemas, the deidealized goal itself): the
 * obstacle obstructed that goal before and no longer does, and with the
 * obstacle alone at 1 that goal's EPS is what it is at 0.
 */
const resolves = (model: KaosModel, countermeasure: Countermeasure) => {
  const variant = applyCountermeasures(model, [countermeasure.id]);
  expect(variant.problems, countermeasure.id).to.deep.equal([]);
  const { at } = variant.applied[0]!;
  expect(at.length, countermeasure.id).to.be.greaterThan(0);
  const [at1, at0] = [1, 0].map(
    (p) =>
      applyCountermeasures(alone(model, countermeasure.obstacle, p), [
        countermeasure.id,
      ]).model,
  );
  for (const goal of at) {
    const what = `${countermeasure.id} at ${goal}`;
    expect(obstructs(model, goal, countermeasure.obstacle), what).to.equal(
      true,
    );
    expect(
      obstructs(variant.model, goal, countermeasure.obstacle),
      what,
    ).to.equal(false);
    expect(eps(at1!, goal), what).to.equal(eps(at0!, goal));
  }
  return variant;
};

/** kaosdoc's Obstacles section of a model. */
const obstaclesSection = (model: KaosModel) =>
  kaosdocDocument(kaosdocGoalModel(model), { title: 'm' }).split(
    '## Obstacles',
  )[1]!;

describe('kaosres on ADS’s resolutions (resolutions.kaos over las.kaos and obstacles.kaos)', () => {
  const countermeasures = countermeasuresOf(ADS);

  it('reads its 33 resolutions as countermeasures: prevention, mitigation, restoration, weakening; no cost, no form', () => {
    expect(countermeasures).to.have.length(33);
    const strategies: Partial<Record<ResolutionStrategy | 'none', number>> = {};
    for (const c of countermeasures)
      strategies[c.strategy ?? 'none'] =
        (strategies[c.strategy ?? 'none'] ?? 0) + 1;
    expect(strategies).to.deep.equal({
      'obstacle mitigation': 17,
      'obstacle prevention': 13,
      'goal restoration': 2,
      'goal deidealization': 1,
    });
    expect(
      countermeasures.every((c) => c.cost === null && c.form === null),
    ).to.equal(true);
  });

  it('applies each of the 33 alone: the obstacle no longer obstructs where it is integrated', () => {
    const said: string[] = [];
    for (const c of countermeasures) {
      const variant = applyCountermeasures(ADS, [c.id]);
      if (variant.problems.length) {
        said.push(
          ...variant.problems.map((p) => `${p.severity}: ${p.message}`),
        );
        continue;
      }
      resolves(ADS, c);
    }
    expect(said).to.deep.equal(ADS_SAID);
  });

  it('applies them all at once: no Problem the model hadn’t, every resolution in kaosdoc’s Obstacles section', () => {
    const variant = applyCountermeasures(
      ADS,
      countermeasures.map((c) => c.id),
    );
    expect(
      variant.problems.map((p) => `${p.severity}: ${p.message}`),
    ).to.deep.equal(ADS_SAID);
    expect(variant.applied).to.have.length(
      33 - ADS_SAID.filter((m) => m.startsWith('error')).length,
    );
    const before = new Set(problems(ADS));
    expect(problems(variant.model).filter((p) => !before.has(p))).to.deep.equal(
      [],
    );
    const section = obstaclesSection(variant.model);
    expect(section).to.include(
      '| Mobilization Taken By Other Ambulance |  |  | Achieve [Mobilization By Other Known], Avo [  ][Mobilization Without Order] | obstacle mitigation, anchored on',
    );
  });
});

describe('kaosres on KAOSTools’ LAS', () => {
  const [only] = countermeasuresOf(LAS);

  it('has one resolution, with no strategy: not applied, said', () => {
    expect(only!.strategy).to.equal(null);
    expect(
      applyCountermeasures(LAS, [only!.id]).problems.map((p) => p.message),
    ).to.deep.equal([
      "avoid_ambulance_not_in_familiar_area resolving ambulance_not_in_familiar_area isn't applied: it has no ResolutionType and no Form: nothing says what it does",
    ]);
  });

  it('as a prevention (its goal is an Avoid of the obstacle): Problems none, resolved, in kaosdoc', () => {
    const link = LAS.links.get(only!.id)!;
    const typed = inheritMetamodel(LAS, {
      ...LAS,
      links: new Map(LAS.links).set(only!.id, {
        ...link,
        customProperties: {
          ...link.customProperties,
          ResolutionType: 'obstacle prevention',
        },
      }),
    });
    const variant = resolves(typed, countermeasuresOf(typed)[0]!);
    const all = applyCountermeasures(typed, [only!.id]);
    expect(problems(all.model)).to.deep.equal([]);
    expect(variant.applied[0]!.integration).to.equal('anchor');
    expect(obstaclesSection(all.model)).to.include(
      '| Ambulance Not In Familiar Area |  |  | Avoid [Ambulance Not In Familiar Area] | obstacle prevention |',
    );
  });
});

describe('kaosres on the Respect-IT tutorial’s Elevator (Figures 33–35)', () => {
  const countermeasures = countermeasuresOf(ELEVATOR);

  it('reads its five resolutions: two preventions (Fig. 34), mitigation, restoration and prevention (Fig. 35)', () => {
    expect(
      countermeasures.map((c) => [c.goal, c.strategy, integrationOf(c)]),
    ).to.deep.equal([
      ['leds_at_least_2in_high', 'obstacle prevention', 'anchor'],
      ['direction_announced_by_voice', 'obstacle prevention', 'anchor'],
      [
        'self_reconfigurable_on_partial_failure',
        'obstacle mitigation',
        'anchor',
      ],
      ['repair_delay_enforced', 'goal restoration', 'anchor'],
      ['worn_out_components_replaced_in_time', 'obstacle prevention', 'anchor'],
    ]);
  });

  it('each alone: the obstacle no longer obstructs the goal it is anchored on', () => {
    for (const c of countermeasures) resolves(ELEVATOR, c);
  });

  it('all at once: no Problem, only the unresolved contrast still obstructs, kaosdoc prints every resolution', () => {
    expect(problems(ELEVATOR)).to.deep.equal([]);
    const variant = applyCountermeasures(
      ELEVATOR,
      countermeasures.map((c) => c.id),
    );
    expect(variant.problems).to.deep.equal([]);
    expect(problems(variant.model)).to.deep.equal([]);
    // every obstacle at 1: only Insufficient display contrast still counts
    let all = variant.model;
    for (const o of [
      'inadequate_led_size',
      'unreadable_by_blind_people',
      'insufficient_display_contrast',
      'service_interrupted',
    ])
      all = alone(all, o, o === 'insufficient_display_contrast' ? 0.25 : 1);
    expect(eps(all, 'passengers_informed_of_direction')).to.equal(0.75);
    expect(eps(all, 'robust_and_reliable')).to.equal(1);
    const section = obstaclesSection(variant.model);
    for (const row of [
      '| Inadequate LED size |  |  | LEDs at least 2in high | obstacle prevention |',
      '| Elevator direction unreadable by blind people |  |  | Elevator direction announced by voice | obstacle prevention |',
      '| Service interrupted |  |  | Self-reconfigurable system in case of partial failure, Maximum permitted time delay for repairing failure enforced, Worn-out components replaced in time | obstacle mitigation; goal restoration; obstacle prevention |',
    ])
      expect(section).to.include(row);
  });
});

/**
 * What the transformation says of ADS's resolutions (errors: not applied):
 * nothing. Its one weakening is anchored on the obstructed leaf itself, which
 * the weakened goal replaces (KAOSTools refuses it: ANCHOR_NO_REFINEMENT).
 */
const ADS_SAID: string[] = [];

/**
 * kaosprop (goal-controller#181): Cailliau and van Lamsweerde's
 * probabilistic obstacle analysis. The oracles are the papers' own numbers:
 *
 * - RE'12 (10.1109/RE.2012.6345805) §IV on the London Ambulance's Fig. 1–2,
 *   each value with its derivation in examples/kaos/las/las.expected.csv,
 *   and Table II's eight combinations;
 * - REJ 18(2):129–146 (2013) §6.3, the carpooling chain from Fig. 6's
 *   obstacle tree and Table 3's estimates to the root goal's 28 %.
 *
 * The models are drawn by hand (./fixtures), from the papers' figures.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import type { AnalysisModel } from '../../../src/engines/analysis';
import {
  criticalCombinations,
  kaospropAnalyses,
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../../src/engines/kaosprop';
import { kaospropEngine } from '../../../src/engines/kaosprop/engine';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const LAS = fixture('re12-las.txt');
const CARPOOLING = fixture('rej13-carpooling.txt');
const ORACLE = readFileSync('../../examples/kaos/las/las.expected.csv', 'utf8');

/** A CSV's rows, its quoted fields unquoted. */
const csv = (text: string): string[][] =>
  text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) =>
      [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)]
        .slice(0, -1)
        .map((m) => m[2] ?? m[1]!),
    );

const modelOf = (text: string) =>
  kaospropAnalysisModel(readKaosObstacleModel(text));
const near = (actual: number, expected: number, within: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${what}: ${actual} is not ${expected} ± ${within}`,
  );

describe('kaosprop: RE’12’s London Ambulance (Fig. 1–2, §IV)', () => {
  const model = modelOf(LAS);
  const { probabilities } = propagateProbabilities(model);

  it('gives every goal and obstacle the probability its derivation does', () => {
    const rows = csv(ORACLE);
    assert.strictEqual(rows.length, 16);
    for (const [id, name, probability] of rows)
      near(probabilities.get(id!)!, Number(probability), 5e-7, name!);
    // every goal and obstacle is computed, and nothing else
    assert.strictEqual(probabilities.size, rows.length);
  });

  it('agrees with the paper’s printed values, but its 0.984 (0.6 × 0.995 + 0.4 × 0.98 is 0.989)', () => {
    for (const [id, name, , paper] of csv(ORACLE)) {
      if (!paper) continue;
      const printed = paper.endsWith('%')
        ? Number(paper.slice(0, -1)) / 100
        : Number(paper);
      if (id === 'achieve_ambulance_mobilized_when_ambulance_allocated') {
        near(printed, 0.984, 0, name!);
        near(probabilities.get(id)!, 0.989, 1e-12, name!);
        continue;
      }
      near(probabilities.get(id!)!, printed, 5e-4, name!);
    }
  });

  it('finds the top goal under its RSR: EPS 92.77 % vs 95 %, SV 2.23 %, a warning', () => {
    const { cases } = kaospropAnalyses.probabilities.run(model);
    const top =
      cases[0]!.values['achieve_ambulance_on_scene_when_incident_reported']!;
    assert.deepStrictEqual(top, {
      value: probabilities.get(
        'achieve_ambulance_on_scene_when_incident_reported',
      ),
      label: 'EPS 92.77% · SV 2.23%',
      severity: 'warning',
    });
    assert.deepStrictEqual(cases[0]!.values['ambulance_lost'], {
      value: 0.019,
      label: 'P 1.90%',
    });
  });

  it('reports each element computed as a step, saying how', () => {
    const [labels] = kaospropAnalyses.probabilities
      .run(model)
      .cases.map((c) => c.steps!.map((s) => s.label));
    assert.strictEqual(labels!.length, 16);
    assert.ok(
      labels!.includes(
        'Ambulance Lost: P 1.90% (AND of Ambulance Not In Familiar Area (20.00%), GPS Not Working (10.00%), Ambulance Lost Iff GPS Not Working And Not In Familiar Area (100.00%) × P(O|SO) 0.95)',
      ),
      labels!.join('\n'),
    );
    assert.ok(
      labels!.some((l) =>
        l.startsWith(
          'Achieve [Ambulance Mobilized When Ambulance Allocated]: EPS 98.90% (case-driven: 0.4 × ',
        ),
      ),
    );
    assert.ok(
      labels!.includes(
        'Achieve [Ambulance On Scene When Incident Reported]: EPS 92.77% · SV 2.23% (milestone-driven: Achieve [Ambulance Allocated When Incident Reported] (98.00%) × Achieve [Ambulance On Scene When Ambulance Allocated] (94.66%))',
      ),
      labels!.join('\n'),
    );
  });

  it('gives Table II’s eight combinations (columns Lost, Stuck, Broken Down)', () => {
    // Table II's EPS, as printed; ours within 0.04 points (the paper rounds,
    // and its 110 row is 0.035 points under the arithmetic)
    const table: [string, number][] = [
      ['111', 0.9277],
      ['110', 0.932],
      ['011', 0.9454],
      ['101', 0.9461],
      ['010', 0.9502],
      ['100', 0.951],
      ['001', 0.9644],
      ['000', 0.9692],
    ];
    const estimates = {
      ambulance_not_in_familiar_area: 0.2,
      gps_not_working: 0.1,
      ambulance_stuck_in_traffic_jam: 0.02,
      ambulance_broken_down: 0.005,
    };
    for (const [row, eps] of table) {
      const [lost, stuck, broken] = [...row].map((c) => c === '1');
      const leaves = new Map([
        [
          'ambulance_not_in_familiar_area',
          lost ? estimates.ambulance_not_in_familiar_area : 0,
        ],
        ['gps_not_working', lost ? estimates.gps_not_working : 0],
        [
          'ambulance_stuck_in_traffic_jam',
          stuck ? estimates.ambulance_stuck_in_traffic_jam : 0,
        ],
        ['ambulance_broken_down', broken ? estimates.ambulance_broken_down : 0],
      ]);
      const ours = propagateProbabilities(model, leaves).probabilities.get(
        'achieve_ambulance_on_scene_when_incident_reported',
      )!;
      near(ours, eps, 4e-4, row);
      // critical (SV > 0) exactly where the paper's is
      assert.strictEqual(ours < 0.95, eps < 0.95, row);
    }
  });

  it('lists the critical leaf combinations: one pair, Stuck and Broken Down; no singleton', () => {
    const found = criticalCombinations(model);
    assert.deepStrictEqual(
      found.map((c) => [c.obstacles, Math.round(c.sv * 1e4) / 1e4]),
      [[['ambulance_stuck_in_traffic_jam', 'ambulance_broken_down'], 0.0045]],
    );
    const { cases } = kaospropAnalyses.criticalCombinations.run(model);
    assert.strictEqual(cases.length, 1);
    assert.strictEqual(
      cases[0]!.label,
      'Ambulance Stuck In Traffic Jam + Ambulance Broken Down: SV 0.45%',
    );
    assert.deepStrictEqual(cases[0]!.selection, [
      'ambulance_stuck_in_traffic_jam',
      'ambulance_broken_down',
      'achieve_ambulance_on_scene_when_incident_reported',
    ]);
  });
});

describe('kaosprop: REJ’13’s carpooling (§6.3, Fig. 6, Table 3)', () => {
  const model = modelOf(CARPOOLING);
  const { probabilities } = propagateProbabilities(model);

  it('reproduces the chain 0.015 → 0.08 → 0.12 → 0.19 → 0.81 → 0.526 → 0.425 → 0.28', () => {
    const chain: [string, number][] = [
      ['driver_at_other_drop_point', 0.015],
      ['drop_point_never_reached', 0.08],
      ['drop_point_not_reached_in_time', 0.12],
      ['drop_point_not_reached_when_passenger_in_car', 0.19],
      ['drop_point_from_instructions_reached_when_passenger_in_car', 0.81],
      ['drop_point_reached_when_passenger_in_car', 0.81],
      ['passenger_at_destination_when_in_car', 0.81],
      ['passenger_at_destination_when_instructions_known', 0.526],
      ['passenger_at_destination_when_ride_planned', 0.425],
      ['ride_request_served', 0.28],
    ];
    for (const [id, printed] of chain)
      near(probabilities.get(id)!, printed, 0.0013, id);
    const { cases } = kaospropAnalyses.probabilities.run(model);
    assert.deepStrictEqual(
      cases[0]!.values['ride_request_served']!.severity,
      'warning',
    );
  });
});

/** A KAOS model as kaosprop reads it, written by hand: elements and links. */
const tiny = (
  elements: [string, string, Record<string, string>?][],
  links: [string, string, string, Record<string, string>?][],
): AnalysisModel => ({
  actors: [],
  elements: elements.map(([id, kind, properties = {}]) => ({
    id,
    kind,
    name: id,
    properties,
  })),
  links: links.map(([kind, source, target, properties = {}], i) => ({
    id: `l${i}`,
    kind,
    source,
    target,
    properties,
  })),
});
const G = 'kaos.BehavioralGoal';
const O = 'kaosObstacles.Obstacle';
const GH = 'kaos.RefinementLinkHub';
const OH = 'kaosObstacles.ObstacleRefinementLinkHub';
/** a goal refined by two leaves (ESR .9 and .8) through one hub with a tactic */
const refined = (tactic: string, legs: [string?, string?] = []) =>
  tiny(
    [
      ['g', G],
      ['a', G, { ESR: '.9' }],
      ['b', G, { ESR: '80%' }],
      ['h', GH, { Tactic: tactic }],
    ],
    [
      [
        'kaos.RefinementLinkStart',
        'a',
        'h',
        legs[0] ? { Probability: legs[0] } : {},
      ],
      [
        'kaos.RefinementLinkStart',
        'b',
        'h',
        legs[1] ? { Probability: legs[1] } : {},
      ],
      ['kaos.RefinementLinkEnd', 'h', 'g'],
    ],
  );
const p = (model: AnalysisModel, id: string) =>
  propagateProbabilities(model).probabilities.get(id)!;

describe('kaosprop: RE’12’s rules (Table I and §IV)', () => {
  it('a refinement’s tactic: the product, but case-driven’s weighted sum', () => {
    for (const tactic of [
      '',
      'milestone-driven',
      'milestone',
      'guard-introduction',
      'divide-and-conquer',
      'uncontrollability',
      'unmonitorability',
    ])
      near(p(refined(tactic), 'g'), 0.72, 1e-12, tactic || 'none');
    near(
      p(refined('case-driven', ['.3', '.7']), 'g'),
      0.3 * 0.9 + 0.7 * 0.8,
      1e-12,
      'case',
    );
    // KAOSTools' name, and two cases with one given: the other its complement
    near(
      p(refined('case', ['30%']), 'g'),
      0.3 * 0.9 + 0.7 * 0.8,
      1e-12,
      'case, one given',
    );
  });

  it('alternative refinements of a goal: either suffices', () => {
    const model = tiny(
      [
        ['g', G],
        ['a', G, { ESR: '.9' }],
        ['b', G, { ESR: '.8' }],
        ['h1', GH],
        ['h2', GH],
      ],
      [
        ['kaos.RefinementLinkStart', 'a', 'h1'],
        ['kaos.RefinementLinkEnd', 'h1', 'g'],
        ['kaos.RefinementLinkStart', 'b', 'h2'],
        ['kaos.RefinementLinkEnd', 'h2', 'g'],
      ],
    );
    near(p(model, 'g'), 1 - 0.1 * 0.2, 1e-12, 'g');
  });

  it('obstacles: an AND times P(O|SO), an OR of refinements, a leaf goal’s obstructions with P(¬G|O)', () => {
    const model = tiny(
      [
        ['o', O],
        ['s1', O, { Probability: '0.5' }],
        ['s2', O, { Probability: '0.4' }],
        ['s3', O, { Probability: '10%' }],
        ['dp', 'kaos.DomainProperty'],
        ['and', OH, { Probability: '0.5' }],
        ['or', OH],
        ['other', O, { Probability: '.3' }],
        ['g', G, { RSR: '0.95', ESR: '0.1' }],
      ],
      [
        ['kaosObstacles.ObstacleRefinementLinkStart', 's1', 'and'],
        ['kaosObstacles.ObstacleRefinementLinkStart', 's2', 'and'],
        ['kaosObstacles.ObstacleRefinementLinkStart', 'dp', 'and'],
        ['kaosObstacles.ObstacleRefinementLinkEnd', 'and', 'o'],
        ['kaosObstacles.ObstacleRefinementLinkStart', 's3', 'or'],
        ['kaosObstacles.ObstacleRefinementLinkEnd', 'or', 'o'],
        ['kaosObstacles.ObstructionLink', 'o', 'g', { Probability: '0.5' }],
        ['kaosObstacles.ObstructionLink', 'other', 'g'],
      ],
    );
    const and = 0.5 * 0.4 * 1 * 0.5;
    const o = 1 - (1 - and) * (1 - 0.1);
    near(p(model, 'o'), o, 1e-12, 'o');
    // obstructed, its ESR is not read
    near(p(model, 'g'), (1 - o * 0.5) * (1 - 0.3), 1e-12, 'g');
  });

  it('a leaf obstacle without an estimate is 0, a value that is no probability its default, both said', () => {
    const model = tiny(
      [
        ['o', O],
        ['g', G, { ESR: 'often' }],
      ],
      [],
    );
    const { probabilities, steps } = propagateProbabilities(model);
    assert.strictEqual(probabilities.get('o'), 0);
    assert.strictEqual(probabilities.get('g'), 1);
    assert.deepStrictEqual(
      steps.map((s) => s.why),
      ['no estimate: 0', 'often is no probability: 1'],
    );
  });

  it('is registered as an analysis engine of KAOS', () => {
    assert.strictEqual(kaospropEngine.id, 'kaosprop');
    assert.strictEqual(kaospropEngine.dialect.framework, 'kaos');
    assert.deepStrictEqual(Object.keys(kaospropEngine.analyses!), [
      'probabilities',
      'criticalCombinations',
    ]);
  });
});

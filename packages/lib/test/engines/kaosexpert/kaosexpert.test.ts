/**
 * kaosexpert (goal-controller#190): RE'15's knowledge uncertainty over
 * kaosprop's obstacle model. The oracles:
 *
 * - RE'15 §VI.B's worked BDD (Fig. 6): Achieve [FireNoticedInTimeWhenHeat]
 *   at 98.22 % from its obstacles' point estimates, the paper's 98.21 %
 *   truncated;
 * - kaosprop's own oracles (RE'12's LAS, REJ'13's carpooling): with point
 *   estimates only, every sample is kaosprop's EPS (LAS, to 1e-12), but
 *   where the BDD counts a shared obstacle once (carpooling's Wrong
 *   Instructions Sent);
 * - RE'15 §V's calibration scores, 0.9305 and 1, through the `.kaos`
 *   reader, the resources and the engine;
 * - the Monte Carlo: seeded (the same seed, the same samples), VU and US
 *   as §III.B defines them.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { kaosNativeFile } from '../../../src/importers/kaos/native';
import {
  expertAnalysis,
  kaosexpertAnalysisModel,
  runCriticalObstacles,
  runUncertainty,
  satisfactionUncertainty,
  simulate,
  uncertaintySpread,
} from '../../../src/engines/kaosexpert';
import {
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../../src/engines/kaosprop';
import { kaosexpertEngine } from '../../../src/engines/kaosexpert/engine';
import type { AnalysisContext } from '../../../src/engines/analysis';

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not ${expected} (± ${tolerance})`,
  );

/** A `.kaos` text read: kaosexpert's view of its model, and its resources as the analyses' context. */
const read = (text: string, options: AnalysisContext['options'] = {}) => {
  const result = kaosNativeFile.read(text, { modelName: 'm' });
  assert.ok(result.model, JSON.stringify(result.diagnostics));
  return {
    model: kaosexpertAnalysisModel(
      readKaosObstacleModel(JSON.stringify(result.model)),
    ),
    context: {
      resources: result.dialectRecord.projectResources,
      options,
    } as AnalysisContext,
    engine: result.dialectRecord.engine,
  };
};

/** RE'15 §VI.B: FireTooDistantFromDetector ∨ (HeatDetectorBroken ∧ NoDetectionWhenHeatDetectorBroken) ∨ FireNoticedTooLateByHeat. */
const HEAT = `
declare goal [ heat ]
  name "Achieve [FireNoticedInTimeWhenHeat]"
  rsr 98%
  obstructedby no_heat_detection
end
declare obstacle [ no_heat_detection ]
  refinedby too_distant
  refinedby heat_detector_broken, no_detection_when_broken
  refinedby too_late
end
declare obstacle [ too_distant ] probability 0.4% end
declare obstacle [ heat_detector_broken ] probability 0.5% end
declare domainhypothesis [ no_detection_when_broken ] probability 98% end
declare obstacle [ too_late ] probability 0.9% end
`;

describe('kaosexpert: obstruction supersets as BDDs (RE’15 §VI.A–B)', () => {
  it('reproduces §VI.B’s worked example: 98.22 % (the paper truncates it to 98.21 %)', () => {
    const { model, context, engine } = read(HEAT, { samples: 3 });
    // a domain hypothesis's probability is kaosexpert's
    assert.strictEqual(engine, 'kaosexpert');
    const analysis = expertAnalysis(model, context);
    assert.strictEqual(analysis.events.length, 4);
    const samples = simulate(analysis, ['heat', 'no_heat_detection']);
    for (const p of samples.get('heat')!) close(p, 0.9821995236, 1e-10);
    for (const p of samples.get('no_heat_detection')!)
      close(p, 0.0178004764, 1e-10);
    const [uncertainty] = runUncertainty(model, undefined, context).cases;
    assert.strictEqual(
      uncertainty!.values.heat!.label,
      'P 98.22% · VU 0 · US 0',
    );
  });

  it('gives kaosprop’s EPS in every sample when every estimate is a point (RE’12’s LAS)', () => {
    const text = readFileSync(
      join(__dirname, '../kaosprop/fixtures/re12-las.txt'),
      'utf8',
    );
    const model = readKaosObstacleModel(text);
    const eps = propagateProbabilities(
      kaospropAnalysisModel(model),
    ).probabilities;
    const analysis = expertAnalysis(kaosexpertAnalysisModel(model), {
      options: { samples: 2 },
    });
    const samples = simulate(analysis, [...eps.keys()]);
    for (const [id, p] of eps)
      for (const sample of samples.get(id)!) close(sample, p, 1e-12);
    // the top goal: 92.77 % against an RSR of 95 % (RE'12)
    close(
      eps.get('achieve_ambulance_on_scene_when_incident_reported')!,
      0.927688,
      5e-7,
    );
  });

  it('counts a shared obstacle once, where kaosprop counts it in each branch (REJ’13’s carpooling)', () => {
    const text = readFileSync(
      join(__dirname, '../kaosprop/fixtures/rej13-carpooling.txt'),
      'utf8',
    );
    const model = readKaosObstacleModel(text);
    const eps = propagateProbabilities(
      kaospropAnalysisModel(model),
    ).probabilities;
    const analysis = expertAnalysis(kaosexpertAnalysisModel(model), {
      options: { samples: 1 },
    });
    const samples = simulate(analysis, [...eps.keys()]);
    const id = 'drop_point_from_instructions_reached_when_passenger_in_car';
    // Wrong Instructions Sent (0.1 %) is under both of its sub-obstacles
    close(samples.get(id)![0]! - eps.get(id)!, 0.000811, 1e-6);
    // elsewhere the same
    close(
      samples.get('drop_point_never_reached')![0]!,
      eps.get('drop_point_never_reached')!,
      1e-12,
    );
  });
});

/** RE'15 Table I's two calibration variables, a third (Push Button Broken, not printed) inside both experts' ranges, and 13 leaf obstacles. */
const FIRE = `
@experts.quantiles "(.1, .5, .9)"
declare goal [ root ]
  name "Achieve [BuildingEvacuatedWhenFire]"
  rsr 98%
  obstructedby fails
end
declare obstacle [ fails ]
${Array.from({ length: 13 }, (_, i) => `  refinedby o${i}`).join('\n')}
end
${Array.from(
  { length: 13 },
  (_, i) => `declare obstacle [ o${i} ]
  probability[expert1] (1%, 1.2%, 1.4%)
  probability[expert2] (0.9%, 1.1%, 1.3%)
end`,
).join('\n')}
declare expert [ expert1 ] name "Expert1" end
declare expert [ expert2 ] name "Expert2" end
declare calibration [ temperature ]
  name "TemperatureSensorBroken"
  probability 4.4%
  probability[expert1] (2.3%, 2.5%, 2.8%)
  probability[expert2] (4.1%, 4.7%, 5.2%)
end
declare calibration [ sprinkler ]
  name "FireSprinklerBroken"
  probability 0.02%
  probability[expert1] (0%, 0.1%, 0.3%)
  probability[expert2] (0%, 0.1%, 0.2%)
end
declare calibration [ push_button ]
  name "PushButtonBroken"
  probability 4.37%
  probability[expert1] (4%, 4.3%, 4.8%)
  probability[expert2] (4%, 4.3%, 4.8%)
end
`;

describe('kaosexpert: experts, calibration and Monte Carlo (RE’15 §V–VI)', () => {
  it('weighs the experts through the .kaos reader and its resources: RE’15’s calibrations, 0.9305 and 1', () => {
    const { model, context } = read(FIRE, { samples: 100 });
    const { weights } = expertAnalysis(model, context);
    const [e1, e2] = weights!.scores;
    assert.strictEqual(e1!.calibration.toFixed(4), '0.9305');
    assert.strictEqual(e2!.calibration, 1);
    assert.strictEqual(e1!.variables, 16);
    const steps = runUncertainty(model, undefined, context).cases[0]!.steps!;
    assert.match(
      steps[1]!.label,
      /^Expert1: information [0-9.]+, calibration 0\.9305, weight/,
    );
  });

  it('samples reproducibly: the same seed, the same distribution; another seed, another', () => {
    const { model, context } = read(FIRE, { samples: 500, seed: 7 });
    const analysis = expertAnalysis(model, context);
    const a = simulate(analysis, ['root']).get('root')!;
    const b = simulate(analysis, ['root']).get('root')!;
    assert.deepStrictEqual(a, b);
    const other = simulate(
      expertAnalysis(model, { ...context, options: { samples: 500, seed: 8 } }),
      ['root'],
    ).get('root')!;
    assert.notDeepStrictEqual(a, other);
    // 13 obstacles near 1.1 %: P(root) near 0.989^13 = 0.866
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    close(mean, 0.866, 0.01);
  });

  it('computes VU and US as §III.B defines them', () => {
    const samples = Float64Array.from([0.8, 0.85, 0.9, 0.99]);
    close(satisfactionUncertainty(samples, 0.98), 0.75, 1e-15);
    close(
      uncertaintySpread(samples, 0.98),
      Math.sqrt((0.18 ** 2 + 0.13 ** 2 + 0.08 ** 2) / 3),
      1e-15,
    );
    close(uncertaintySpread(Float64Array.from([0.99]), 0.98), 0, 0);
    const { model, context } = read(FIRE, { samples: 200 });
    const value = runUncertainty(model, undefined, context).cases[0]!.values
      .root!;
    assert.match(value.label!, /^P 8[0-9]\.[0-9]{2}% · VU 1 · US 0\.1[0-9]+$/);
    assert.strictEqual(value.severity, 'warning');
    assert.strictEqual(value.distribution!.samples, 200);
    assert.deepStrictEqual(
      value.distribution!.quantiles.map((q) => q.p),
      [0.05, 0.25, 0.5, 0.75, 0.95],
    );
  });

  it('finds the critical obstacles: each alone, the others at 0 (§VII)', () => {
    const { model, context } = read(HEAT.replace('rsr 98%', 'rsr 99.5%'), {
      samples: 10,
    });
    const labels = runCriticalObstacles(model, undefined, context).cases.map(
      (c) => c.label,
    );
    // alone, only 0.9 % leaves the goal under 99.5 % (99.1 %); 0.4 % and
    // 0.5 % × 98 % don't (99.6 %, 99.51 %)
    assert.deepStrictEqual(labels, ['too_late: VU 1 · US 0.004']);
  });

  it('is the workbench’s engine: its analyses read the experts and calibrations, and its options', () => {
    assert.deepStrictEqual(
      Object.values(kaosexpertEngine.analyses!).map((a) => a.inputs),
      [
        ['expert', 'calibration'],
        ['expert', 'calibration'],
      ],
    );
    assert.deepStrictEqual(
      kaosexpertEngine.options!.map((o) => [o.key, o.default]),
      [
        ['samples', 10000],
        ['seed', 1],
        ['weighting', 're15'],
      ],
    );
  });
});

describe('kaosexpert: the fire-alarm seed (RE’15’s running example, #197)', () => {
  const dir = join(__dirname, '../../../../../examples/kaos/fire-alarm');
  const file = (name: string) => readFileSync(join(dir, name), 'utf8');
  const seed = (samples: number) => ({
    model: kaosexpertAnalysisModel(
      readKaosObstacleModel(file('fire-alarm.txt')),
    ),
    context: {
      resources: {
        expert: { 'experts.json': file('experts.json') },
        calibration: { 'calibrations.json': file('calibrations.json') },
      },
      options: { samples, seed: 1 },
    } as AnalysisContext,
  });

  it('has 13 leaf obstacles, 2 experts and 3 calibration variables: RE’15’s calibrations from the seed itself, N = 16', () => {
    const { model, context } = seed(10);
    const analysis = expertAnalysis(model, context);
    assert.strictEqual(analysis.leaves.size, 13);
    const [e1, e2] = analysis.weights!.scores;
    assert.strictEqual(e1!.variables, 16);
    assert.strictEqual(e1!.calibrationVariables, 3);
    assert.strictEqual(e1!.calibration.toFixed(4), '0.9305');
    assert.strictEqual(e2!.calibration, 1);
  });

  it('violates its root for certain (VU 1, as RE’15), and finds Table III’s seven critical obstacles, ranked as the paper but BatteryOutofService', () => {
    const { model, context } = seed(5000);
    const root = runUncertainty(model, undefined, context).cases[0]!.values
      .building_evacuated_when_fire!;
    assert.match(root.label!, /· VU 1 · US 0\.1[56]/);
    const ranked = runCriticalObstacles(model, undefined, context).cases.map(
      (c) => c.id.split(':')[1],
    );
    // Table III's seven, the two certain ones first; the paper's order but
    // for BatteryOutofService (its VU is 1 in the paper, 0.41 here)
    assert.deepStrictEqual(ranked, [
      'wrong_smoke_notification',
      'smoke_detector_broken',
      'fire_detection_delayed',
      'fire_central_notification_delayed',
      'network_down',
      'battery_out_of_service',
      'fire_noticed_too_late_by_smoke',
    ]);
  });
});

describe('kaosexpert: the ambulance seed (ADS, RE’15’s field validation, #198)', () => {
  const dir = join(__dirname, '../../../../../examples/kaos/ambulance');
  const file = (name: string) => readFileSync(join(dir, name), 'utf8');
  const seed = (samples: number) => ({
    model: kaosexpertAnalysisModel(
      readKaosObstacleModel(file('ambulance.txt')),
    ),
    context: {
      resources: {
        expert: { 'experts.json': file('experts.json') },
        calibration: { 'calibrations.json': file('calibrations.json') },
      },
      options: { samples, seed: 1 },
    } as AnalysisContext,
  });

  it('weighs its five experts over 50 variables (47 leaves, 3 calibrations), every weight finite', () => {
    const { model, context } = seed(10);
    const analysis = expertAnalysis(model, context);
    assert.strictEqual(analysis.leaves.size, 47);
    const scores = analysis.weights!.scores;
    assert.deepStrictEqual(
      scores.map((s) => s.expert),
      ['e1', 'e2', 'e3', 'e4', 'e5'],
    );
    // e4's (30%, 10%, 50%) for Allocated Ambulance Not At Station, the
    // leaf and the calibration variable, is a Problem: left out, both
    assert.deepStrictEqual(
      scores.map((s) => [s.variables, s.calibrationVariables]),
      [
        [50, 3],
        [50, 3],
        [50, 3],
        [48, 2],
        [50, 3],
      ],
    );
    const weights = [0.144099, 0.271883, 0.143218, 0.217959, 0.222841];
    scores.forEach((s, i) => close(s.weight, weights[i]!, 1e-6));
  });

  it('violates Achieve [Incident Resolved] for certain (VU 1, as RE’15), US 0.946; two obstacles alone more than 90 % certain to', () => {
    const { model, context } = seed(2000);
    const root = runUncertainty(model, undefined, context).cases[0]!.values
      .achieve_incident_resolved!;
    assert.match(root.label!, /· VU 1 · US 0\.946/);
    const critical = runCriticalObstacles(model, undefined, context)
      .cases.filter((c) => /VU (0\.9|1)/.test(c.label))
      .map((c) => c.id.split(':')[1]);
    assert.deepStrictEqual(critical, [
      'ambulance_stopped_in_traffic',
      'ambulance_traffic_deviation',
    ]);
  });
});

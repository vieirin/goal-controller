/**
 * Cooke's classical model as RE'15 applies it (goal-controller#190, D3).
 * Two oracles:
 *
 * - RE'15's own numbers (DOI 10.1109/RE.2015.7320413, §V): Expert1's
 *   calibration 0.9305, Expert2's 1, from Table I's two calibration
 *   variables among the model's 16 estimated variables (13 leaf obstacles,
 *   3 calibration variables);
 * - the author's code, run under Mono in Docker (ExpertOpinionSharp's
 *   `CookFramework` at 90cae43, MIT, with MathNet.Numerics 3.20.2): its
 *   scores, weights and optimal cut-off for the same inputs, printed with
 *   `{0:R}`, are pinned here to 1e-12.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  cooke,
  type CookeVariable,
} from '../../../src/engines/kaosexpert/cooke';

const LEVELS = [0.1, 0.5, 0.9];
const variable = (
  id: string,
  e1: number[],
  e2: number[],
  known?: number,
): CookeVariable => ({
  id,
  estimates: new Map([
    ['expert1', e1.map((x) => x / 100)],
    ['expert2', e2.map((x) => x / 100)],
  ]),
  ...(known !== undefined && { known: known / 100 }),
});

/** Table I's calibration variables, beside 14 variables with interior realisations (N = 16). */
const TABLE_I = [
  variable('temperature', [2.3, 2.5, 2.8], [4.1, 4.7, 5.2], 4.4),
  variable('sprinkler', [0, 0.1, 0.3], [0, 0.1, 0.2], 0.02),
  ...Array.from({ length: 14 }, (_, i) =>
    variable(`v${i}`, [1, 2, 3], [1, 2, 3]),
  ),
];

/** Cailliau's later `firesystem.kaos` (ancailliau/phd-thesis, running-examples-others), its values only. */
const THESIS = [
  variable('smoke_detector_broken', [2.46, 2.76, 3.07], [2.16, 2.42, 2.69]),
  variable('late_detection_smoke', [1.46, 1.83, 2.04], [1.26, 1.42, 2.24]),
  variable('heat_detector_broken', [0.41, 0.46, 0.51], [0.5, 0.56, 0.62]),
  variable('late_detection_heat', [0.38, 0.56, 0.78], [0.89, 0.92, 0.99]),
  variable('too_distant', [0.41, 0.46, 0.51], [0.5, 0.56, 0.62]),
  variable('detection_delayed', [1.29, 2.48, 3.2], [1.3, 2.98, 3.48]),
  variable('false_alarm_smoke', [3.49, 3.92, 4.35], [3.91, 4.4, 4.89]),
  variable('false_alarm_heat', [0.47, 0.53, 0.59], [0.38, 0.43, 0.48]),
  variable('battery_out', [2.31, 2.59, 2.88], [0.16, 0.18, 0.19]),
  variable('light_broken', [0.93, 1.05, 1.16], [0.85, 0.96, 1.06]),
  variable('bell_broken', [1.47, 1.65, 1.83], [1.7, 1.91, 2.12]),
  variable('network_down', [0.95, 2.31, 3.67], [1.46, 2.39, 3.31]),
  variable(
    'fire_central_notification_delay',
    [1.29, 2.48, 3.2],
    [1.3, 2.98, 3.48],
  ),
  variable('calibration1', [3.812, 4.285, 4.759], [3.961, 4.453, 4.945], 4.37),
  variable('calibration2', [2.307, 2.594, 2.881], [4.184, 4.704, 5.224], 4.37),
  variable('calibration3', [0.023, 0.026, 0.029], [0.019, 0.022, 0.024], 0.02),
];

const run = (variables: CookeVariable[], weighting?: 're15' | 'classical') =>
  cooke({
    levels: LEVELS,
    experts: ['expert1', 'expert2'],
    variables,
    ...(weighting && { weighting }),
  });

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not ${expected} (± ${tolerance})`,
  );

describe('kaosexpert: Cooke as RE’15 applies it', () => {
  it('reproduces RE’15’s calibration scores: 0.9305 and 1 (N = 16)', () => {
    const [e1, e2] = run(TABLE_I).scores;
    assert.strictEqual(e1!.calibration.toFixed(4), '0.9305');
    assert.strictEqual(e2!.calibration, 1);
    // Expert1: temperature (4.4 %) above its 90 % quantile, sprinkler inside
    assert.deepStrictEqual(
      e1!.bins.map((s) => s * 16),
      [0, 1, 0, 1],
    );
    close(e1!.statistic, 2 * Math.log(1.25), 1e-12);
    // the author's code (Mono): 0.93052310130834992
    close(e1!.calibration, 0.93052310130834992, 1e-12);
    close(e1!.information, 0.11456197538940738, 1e-12);
    close(e2!.information, 0.084997673739333035, 1e-12);
  });

  it('gives the author’s code’s scores, weights and cut-off on firesystem.kaos', () => {
    const result = run(THESIS);
    const [e1, e2] = result.scores;
    close(e1!.information, 0.45199378554378572, 1e-12);
    close(e1!.calibration, 0.82721944467281627, 1e-12);
    close(e2!.information, 0.67814518653261191, 1e-12);
    assert.strictEqual(e2!.calibration, 1);
    close(e1!.weight, 0.35540178949218448, 1e-12);
    close(e2!.weight, 0.64459821050781563, 1e-12);
    // the optimal cut-off Brent's search returns (the largest weight): no one is cut
    close(result.alpha, 0.644598210507815, 1e-12);
  });

  it('weighs by information × calibration, normalised (RE’15’s printed scores)', () => {
    // §V prints the scores, then the weights: 0.4216 × 0.9305 and 0.4740 × 1
    const w1 = 0.4216 * 0.9305;
    const w2 = 0.474 * 1;
    // 0.45285 and 0.54715: the paper truncates them, 0.4528 and 0.5471
    close(w1 / (w1 + w2), 0.4528, 1e-4);
    close(w2 / (w1 + w2), 0.5471, 1e-4);
  });

  it('scores the textbook way under `classical`: calibration variables only', () => {
    const [e1, e2] = run(TABLE_I, 'classical').scores;
    // s = (0, ½, 0, ½) and (0, 1, 0, 0) against p = (.1, .4, .4, .1), N = 2
    assert.deepStrictEqual(e1!.bins, [0, 0.5, 0, 0.5]);
    assert.deepStrictEqual(e2!.bins, [0, 1, 0, 0]);
    close(
      e1!.statistic,
      4 * (0.5 * Math.log(0.5 / 0.4) + 0.5 * Math.log(0.5 / 0.1)),
      1e-12,
    );
    close(e1!.calibration, e2!.calibration, 1e-12);
  });

  it('mixes the experts’ quantile distributions by weight (the decision maker)', () => {
    const result = run(THESIS);
    const dm = result.decisionMaker('smoke_detector_broken')!;
    const [low, high] = result.rangeOf('smoke_detector_broken')!;
    // the range: 2.16 %–3.07 %, 10 % of it beyond each end
    close(low, 0.0216 - 0.00091 * 1, 1e-12);
    close(high, 0.0307 + 0.00091, 1e-12);
    const [w1, w2] = result.scores.map((s) => s.weight);
    // at Expert1's median, its CDF is .5; Expert2's is above its 90 % quantile
    const e2At = 0.9 + (0.1 * (0.0276 - 0.0269)) / (high - 0.0269);
    close(dm.cdf(0.0276), w1! * 0.5 + w2! * e2At, 1e-12);
    close(dm.quantile(dm.cdf(0.025)), 0.025, 1e-9);
  });
});

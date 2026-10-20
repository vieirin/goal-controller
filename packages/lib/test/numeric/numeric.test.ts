/**
 * The numeric back-end (goal-controller#190, D5): special functions,
 * distributions, the seeded generator and BDDs, checked against closed
 * forms and RE'15's worked BDD example (§VI.B, Fig. 6).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { distributionOf } from '@goal-controller/dialect';
import { Bdd } from '../../src/numeric/bdd';
import {
  complementOf,
  continuousOf,
  extendTriangular,
  mixture,
} from '../../src/numeric/distributions';
import { seededRandom } from '../../src/numeric/random';
import {
  betaInc,
  chiSquaredCdf,
  invBetaInc,
  lnGamma,
} from '../../src/numeric/special';

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not ${expected} (± ${tolerance})`,
  );

describe('numeric: special functions', () => {
  it('computes ln Γ', () => {
    close(lnGamma(1), 0, 1e-14);
    close(lnGamma(5), Math.log(24), 1e-13);
    close(lnGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-13);
  });

  it('computes the incomplete beta function and its inverse', () => {
    // I_x(1, 1) = x; I_x(2, 1) = x²; I_x(2, 2) = 3x² − 2x³
    close(betaInc(1, 1, 0.3), 0.3, 1e-14);
    close(betaInc(2, 1, 0.3), 0.09, 1e-14);
    close(betaInc(2, 2, 0.3), 3 * 0.09 - 2 * 0.027, 1e-14);
    for (const [a, b] of [
      [2, 3],
      [0.5, 0.5],
      [1.2, 40],
      [30, 2],
    ] as const)
      for (const p of [0.001, 0.1, 0.5, 0.9, 0.999])
        close(betaInc(a, b, invBetaInc(p, a, b)), p, 1e-10);
  });

  it('computes the χ² CDF: 3 degrees of freedom in closed form', () => {
    const closed = (x: number) => {
      // erf by its series, enough terms for x ≤ 10
      const t = Math.sqrt(x / 2);
      let term = t;
      let sum = t;
      for (let n = 1; n < 200; n++) {
        term *= (-t * t) / n;
        sum += term / (2 * n + 1);
      }
      return (
        (2 / Math.sqrt(Math.PI)) * sum -
        Math.sqrt((2 * x) / Math.PI) * Math.exp(-x / 2)
      );
    };
    for (const x of [0.1, 0.4463, 1, 3.665, 8])
      close(chiSquaredCdf(3, x), closed(x), 1e-12);
    close(chiSquaredCdf(2, 2), 1 - Math.exp(-1), 1e-14);
  });
});

describe('numeric: distributions', () => {
  const of = (text: string) =>
    continuousOf(distributionOf(text, { point: true })!);

  it('reads each of KAOSTools’ forms', () => {
    assert.deepStrictEqual(distributionOf('beta[2, 3]'), {
      kind: 'beta',
      alpha: 2,
      beta: 3,
    });
    assert.deepStrictEqual(distributionOf('(2.4%, 2.7%, 3%)'), {
      kind: 'quantiles',
      values: [0.024, 0.027000000000000003, 0.03],
      form: 'tuple',
    });
    assert.strictEqual(distributionOf('PERT[1%, 2%, 5%]')!.kind, 'pert');
    assert.strictEqual(distributionOf('quantiles[.1, .2]')!.kind, 'quantiles');
    assert.strictEqual(distributionOf('80%'), null);
    assert.deepStrictEqual(distributionOf('80%', { point: true }), {
      kind: 'point',
      value: 0.8,
    });
    assert.strictEqual(distributionOf('(30%, 10%, 50%)'), null);
    assert.strictEqual(distributionOf('triangular[.2, .1, .5]'), null);
    assert.strictEqual(distributionOf('gamma[1, 2]'), null);
  });

  it('samples by the inverse CDF, each form', () => {
    close(of('uniform[.2, .4]').quantile(0.25), 0.25, 1e-14);
    close(of('triangular[0, .5, 1]').quantile(0.5), 0.5, 1e-14);
    close(of('triangular[0, .5, 1]').cdf(0.25), 0.125, 1e-14);
    // PERT[0, ½, 1] is Beta(3, 3): symmetric
    close(of('pert[0, .5, 1]').quantile(0.5), 0.5, 1e-10);
    close(of('pert[.1, .2, .6]').mean, (0.1 + 4 * 0.2 + 0.6) / 6, 1e-14);
    close(of('beta[2, 3]').mean, 0.4, 1e-14);
    // quantiles: through each at its level, 10 % of their range beyond each end
    const q = of('(10%, 20%, 30%)');
    close(q.min, 0.08, 1e-14);
    close(q.max, 0.32, 1e-14);
    close(q.quantile(0.5), 0.2, 1e-14);
    close(q.cdf(0.3), 0.9, 1e-14);
    close(q.quantile(0.05), 0.09, 1e-14);
  });

  it('mixes components by weight, a draw of each by its own', () => {
    const m = mixture([
      { weight: 0.25, distribution: of('uniform[0, .1]') },
      { weight: 0.75, distribution: of('uniform[.1, .2]') },
    ]);
    close(m.cdf(0.1), 0.25, 1e-14);
    close(m.quantile(0.625), 0.15, 1e-12);
    close(m.mean, 0.25 * 0.05 + 0.75 * 0.15, 1e-14);
  });

  it('mirrors a distribution, 1 − X (goal-controller#199, a leaf goal’s 1 − ESR)', () => {
    const c = complementOf(of('uniform[.2, .5]'));
    close(c.min, 0.5, 1e-14);
    close(c.max, 0.8, 1e-14);
    close(c.mean, 0.65, 1e-14);
    close(c.quantile(0.25), 0.575, 1e-14);
    close(c.cdf(0.65), 0.5, 1e-14);
  });

  it('extends a triangular’s elicited (a0, m, b0) by a tail (HASE’11 Fig. 3, §III-B2, goal-controller#199)', () => {
    // the paper's worked example: elicited (.85, .90, .96), 5 % tails,
    // extended to (.82548, .90, .9863); our exact solve of the same two
    // equations (CDF(a0) = tail, CDF(b0) = 1 − tail) is close but not
    // identical -- the paper's own rounding, not a different formula
    // (examples/kaos/mooring/mooring.expected.csv has the exact value)
    const { min, max } = extendTriangular(0.85, 0.9, 0.96, 0.05);
    close(min, 0.82548, 2e-4);
    close(max, 0.9863, 2e-4);
    // the result's own triangular(min, .9, max) really does put a0/b0 at
    // the tail levels: the defining property, exactly, not approximately
    const extended = continuousOf({ kind: 'triangular', min, mode: 0.9, max });
    close(extended.cdf(0.85), 0.05, 1e-9);
    close(extended.cdf(0.96), 0.95, 1e-9);
  });

  it('extends a triangular symmetrically when the elicitation is symmetric', () => {
    const { min, max } = extendTriangular(0.4, 0.5, 0.6, 0.05);
    close(0.5 - min, max - 0.5, 1e-9);
  });

  it('extends a triangular when the mode equals the elicited lower or upper bound (rv199’s finding: the naive initial guess collapses onto a spurious root there)', () => {
    const atLower = extendTriangular(0.5, 0.5, 0.9, 0.05);
    assert.ok(atLower.min < 0.5, `min ${atLower.min} should be below a0`);
    let c = continuousOf({
      kind: 'triangular',
      min: atLower.min,
      mode: 0.5,
      max: atLower.max,
    });
    close(c.cdf(0.5), 0.05, 1e-6);
    close(c.cdf(0.9), 0.95, 1e-6);

    const atUpper = extendTriangular(0.3, 0.9, 0.9, 0.05);
    assert.ok(atUpper.max > 0.9, `max ${atUpper.max} should be above b0`);
    c = continuousOf({
      kind: 'triangular',
      min: atUpper.min,
      mode: 0.9,
      max: atUpper.max,
    });
    close(c.cdf(0.3), 0.05, 1e-6);
    close(c.cdf(0.9), 0.95, 1e-6);
  });

  it('refuses an elicitation with no range, or the mode outside it', () => {
    assert.throws(() => extendTriangular(0.5, 0.5, 0.5, 0.05), /a0 < b0/);
    assert.throws(() => extendTriangular(0.5, 0.9, 0.6, 0.05), /a0 ≤ m ≤ b0/);
  });

  it('draws the same from the same seed, and uniformly', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const drawn = Array.from({ length: 1000 }, () => a());
    assert.deepStrictEqual(
      drawn,
      Array.from({ length: 1000 }, () => b()),
    );
    assert.notStrictEqual(seededRandom(43)(), seededRandom(42)());
    const mean = drawn.reduce((x, y) => x + y, 0) / drawn.length;
    close(mean, 0.5, 0.03);
    assert.ok(drawn.every((x) => x >= 0 && x < 1));
  });
});

describe('numeric: BDDs', () => {
  it('reproduces RE’15’s worked example (§VI.B, Fig. 6)', () => {
    // FireTooDistantFromDetector ∨ (HeatDetectorBroken ∧
    // NoDetectionWhenHeatDetectorBroken) ∨ FireNoticedTooLateByHeat, in
    // Fig. 6's order: HeatDetectorBroken on top
    const bdd = new Bdd();
    const heat = bdd.newVariable();
    const noDetection = bdd.newVariable();
    const distant = bdd.newVariable();
    const late = bdd.newVariable();
    const os = bdd.or(distant, bdd.and(heat, noDetection), late);
    const p = [0.005, 0.98, 0.004, 0.009];
    // the nodes bottom up, as the paper computes them
    const lateNode = 0.009; // 0.991 × 0 + 0.009 × 1
    const distantNode = 0.996 * lateNode + 0.004 * 1;
    const noDetectionNode = 0.02 * distantNode + 0.98 * 1;
    const heatNode = 0.995 * distantNode + 0.005 * noDetectionNode;
    close(lateNode, 0.009, 1e-15);
    close(distantNode, 0.012964, 1e-15); // the paper: 0.013
    close(noDetectionNode, 0.98025928, 1e-15); // 0.9802
    close(heatNode, 0.0178004764, 1e-10); // 0.0178
    close(bdd.probability(os, p), heatNode, 1e-15);
    // 98.2199 %: the paper prints 98.21 % (truncated)
    close(1 - bdd.probability(os, p), 0.9821995236, 1e-10);
    // Fig. 6: one node per event
    assert.strictEqual(bdd.nodeCount(os), 4);
  });

  it('counts a shared event once', () => {
    const bdd = new Bdd();
    const a = bdd.newVariable();
    const b = bdd.newVariable();
    const c = bdd.newVariable();
    // (a ∧ b) ∨ (a ∧ c) = a ∧ (b ∨ c)
    const f = bdd.or(bdd.and(a, b), bdd.and(a, c));
    close(bdd.probability(f, [0.5, 0.5, 0.5]), 0.5 * 0.75, 1e-15);
    assert.strictEqual(f, bdd.and(a, bdd.or(b, c)));
    close(bdd.probability(bdd.not(f), [0.5, 0.5, 0.5]), 1 - 0.375, 1e-15);
    const g = bdd.ite(a, b, c);
    close(bdd.probability(g, [0.3, 0.6, 0.1]), 0.3 * 0.6 + 0.7 * 0.1, 1e-15);
  });
});

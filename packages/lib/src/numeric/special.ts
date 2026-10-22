/**
 * Special functions in pure TypeScript (goal-controller#190, D5): the log
 * gamma function, the regularised incomplete beta and gamma functions and
 * their inverses, as Numerical Recipes (Press et al., 3rd ed., §6.1–6.4)
 * computes them. What the Beta and PERT distributions' inverse CDFs and
 * Cooke's calibration score (a χ² tail) need, and the normal distribution's
 * CDF and quantile (goal-controller#193); no numeric library.
 */

const LANCZOS = [
  57.15623566586292, -59.59796035547549, 14.136097974741746,
  -0.4919138160976202, 0.00003399464998481189, 0.00004652362892704858,
  -0.00009837447530487956, 0.0001580887032249125, -0.00021026444172410488,
  0.00021743961811521265, -0.0001643181065367639, 0.00008441822398385275,
  -0.000026190838401581408, 0.0000036899182659531625,
];

/** ln Γ(x), x > 0 (NR §6.1, Lanczos with g = 671/128). */
export const lnGamma = (x: number): number => {
  let y = x;
  const tmp = x + 5.2421875;
  const t = (x + 0.5) * Math.log(tmp) - tmp;
  let ser = 0.9999999999999971;
  for (const c of LANCZOS) ser += c / ++y;
  return t + Math.log((2.5066282746310007 * ser) / x);
};

const EPS = 1e-15;
const FPMIN = 1e-300;

/** The continued fraction of the incomplete beta function (NR §6.4, modified Lentz). */
const betaFraction = (a: number, b: number, x: number): number => {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) <= EPS) break;
  }
  return h;
};

/** I_x(a, b), the regularised incomplete beta function: the Beta(a, b) CDF at x. */
export const betaInc = (a: number, b: number, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lnGamma(a + b) -
      lnGamma(a) -
      lnGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b;
};

/** The x with I_x(a, b) = p: the Beta(a, b) quantile (NR §6.4's invbetai, Halley steps). */
export const invBetaInc = (p: number, a: number, b: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const a1 = a - 1;
  const b1 = b - 1;
  let x: number;
  if (a >= 1 && b >= 1) {
    const pp = p < 0.5 ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(pp));
    x = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (p < 0.5) x = -x;
    const al = (x * x - 3) / 6;
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1));
    const w =
      (x * Math.sqrt(al + h)) / h -
      (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    const lna = Math.log(a / (a + b));
    const lnb = Math.log(b / (a + b));
    const t = Math.exp(a * lna) / a;
    const u = Math.exp(b * lnb) / b;
    const w = t + u;
    x =
      p < t / w
        ? Math.pow(a * w * p, 1 / a)
        : 1 - Math.pow(b * w * (1 - p), 1 / b);
  }
  const afac = -lnGamma(a) - lnGamma(b) + lnGamma(a + b);
  for (let j = 0; j < 30; j++) {
    if (x === 0 || x === 1) return x;
    const err = betaInc(a, b, x) - p;
    let t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac);
    const u = err / t;
    t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x))));
    x -= t;
    if (x <= 0) x = 0.5 * (x + t);
    if (x >= 1) x = 0.5 * (x + t + 1);
    if (Math.abs(t) < 1e-12 * x && j > 0) break;
  }
  return x;
};

/**
 * P(a, x) and Q(a, x) = 1 − P(a, x), the regularised incomplete gamma
 * functions (NR §6.2: the series below a + 1, where P is direct; the
 * continued fraction above, where Q is), each without the other's
 * cancellation in its tail.
 */
const gammaPQ = (a: number, x: number): { p: number; q: number } => {
  if (x <= 0) return { p: 0, q: 1 };
  const gln = lnGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 10000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    const p = sum * Math.exp(-x + a * Math.log(x) - gln);
    return { p, q: 1 - p };
  }
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) <= EPS) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gln) * h;
  return { p: 1 - q, q };
};

/** P(a, x), the regularised lower incomplete gamma function (NR §6.2). */
export const gammaP = (a: number, x: number): number => gammaPQ(a, x).p;

/**
 * Φ(x), the standard normal CDF (goal-controller#193): ½(1 + erf(x/√2)),
 * erf(z) = P(½, z²) (NR §6.2.2), from Q's side below 0 so the lower tail
 * keeps its precision.
 */
export const normalCdf = (x: number): number => {
  const { p, q } = gammaPQ(0.5, (x * x) / 2);
  return x < 0 ? q / 2 : (1 + p) / 2;
};

// Acklam's rational approximation of Φ⁻¹ (relative error 1.15e-9), each
// result then refined by one Halley step on Φ
const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1,
];
const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const ACKLAM_D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416,
];
const horner = (coefficients: readonly number[], x: number) =>
  coefficients.reduce((sum, c) => sum * x + c, 0);

/** Φ⁻¹(u), the standard normal quantile, u in (0, 1); ∓∞ at 0 and 1. */
export const normalQuantile = (u: number): number => {
  if (u <= 0) return -Infinity;
  if (u >= 1) return Infinity;
  const low = 0.02425;
  let x: number;
  if (u < low || u > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(u < low ? u : 1 - u));
    const tail = horner(ACKLAM_C, q) / (horner(ACKLAM_D, q) * q + 1);
    x = u < low ? tail : -tail;
  } else {
    const q = u - 0.5;
    const r = q * q;
    x = (horner(ACKLAM_A, r) * q) / (horner(ACKLAM_B, r) * r + 1);
  }
  const e = normalCdf(x) - u;
  const step = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - step / (1 + (x * step) / 2);
};

/** The χ² distribution's CDF with `dof` degrees of freedom at x (0 for x ≤ 0). */
export const chiSquaredCdf = (dof: number, x: number): number =>
  x <= 0 ? 0 : gammaP(dof / 2, x / 2);

/**
 * Brent's local minimiser of a function of one variable on an interval
 * (Brent, *Algorithms for Minimization without Derivatives*, 1973, ch. 5,
 * `localmin`: golden-section search with parabolic steps), as KAOSTools'
 * ExpertOpinionSharp writes it (`OptimizationHelper.LocalMin`, MIT), the
 * routine RE'15's tool finds Cooke's optimal cut-off with. Ported line for
 * line, its one departure from Brent's text included: a golden-section
 * step keeps the interval's end itself, not its distance to x, as the
 * previous step's length (`e`).
 */
export const localMin = (
  lowerBound: number,
  upperBound: number,
  f: (x: number) => number,
  eps = 1.2e-16,
  t = Math.sqrt(Number.MIN_VALUE),
): number => {
  let lower = lowerBound;
  let upper = upperBound;
  const c = (3 - Math.sqrt(5)) / 2;
  let x = lower + c * (upper - lower);
  let v = x;
  let w = x;
  let fx = f(x);
  let fv = fx;
  let fw = fx;
  let e = 0;
  let d = 0;
  let m = 0.5 * (lower + upper);
  let tol = eps * Math.abs(x) + t;
  let t2 = 2 * tol;
  while (Math.abs(x - m) > t2 - 0.5 * (upper - lower)) {
    let p = 0;
    let q = 0;
    let r = 0;
    if (Math.abs(e) > tol) {
      r = (x - w) * (fx - fv);
      q = (x - v) * (fx - fw);
      p = (x - v) * q - (x - w) * r;
      q = 2 * (q - r);
      if (q > 0) p = -p;
      else q = -q;
      r = e;
      e = d;
    }
    let u: number;
    if (
      Math.abs(p) < Math.abs(0.5 * q * r) &&
      p > q * (lower - x) &&
      p < q * (upper - x)
    ) {
      d = p / q;
      u = x + d;
      if (u - lower < t2 || upper - u < t2) d = x < m ? tol : -tol;
    } else {
      e = x < m ? upper : lower;
      d = c * (e - x);
    }
    u = Math.abs(d) >= tol ? x + d : x + (d > 0 ? tol : -tol);
    const fu = f(u);
    if (fu <= fx) {
      if (u < x) upper = x;
      else lower = x;
      v = w;
      fv = fw;
      w = x;
      fw = fx;
      x = u;
      fx = fu;
    } else {
      if (u < x) lower = u;
      else upper = u;
      if (fu <= fw || w === x) {
        v = w;
        fv = fw;
        w = u;
        fw = fu;
      } else if (fu <= fv || v === x || v === w) {
        v = u;
        fv = fu;
      }
    }
    m = 0.5 * (lower + upper);
    tol = eps * Math.abs(x) + t;
    t2 = 2 * tol;
  }
  return x;
};

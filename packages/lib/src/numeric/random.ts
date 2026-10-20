/**
 * A seeded pseudo-random generator (goal-controller#190, D4): the same seed
 * gives the same draws on every platform, so a Monte Carlo run is
 * reproducible and its tests deterministic. sfc32 (Chris Doty-Humphrey's
 * Small Fast Counting generator, PractRand-tested), seeded through
 * splitmix32 so that nearby seeds give unrelated streams.
 */

/** A uniform draw in [0, 1). */
export type Random = () => number;

const splitmix32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
};

/** A generator of uniform draws in [0, 1) from a seed (an integer; its low 32 bits). */
export const seededRandom = (seed: number): Random => {
  const next = splitmix32(seed);
  let a = next();
  let b = next();
  let c = next();
  let d = next();
  const draw = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
  // the first draws of a fresh state are discarded, as sfc32's author does
  for (let i = 0; i < 12; i++) draw();
  return draw;
};

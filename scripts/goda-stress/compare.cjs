/**
 * The GODA stress test's comparisons (goal-controller#35): an MDP against
 * the reference after whitespace normalization, PCTL files byte for byte,
 * eval_formula.sh as a set of lines, and (lib's evaluator, re-exported) the
 * parametric formulas numerically. Build lib first (`pnpm stress:goda` does).
 */

// ---------------------------------------------------------------------------
// MDP: whitespace normalization and a line diff
// ---------------------------------------------------------------------------

/** Lines trimmed, runs of blanks made one space, empty lines dropped. */
const normalizeMdp = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0);

const counts = (lines) => {
  const map = new Map();
  for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
  return map;
};

/** Lines of `a` that `b` lacks, with multiplicity, in `a`'s order. */
const missingFrom = (a, b) => {
  const left = counts(b);
  return a.filter((line) => {
    const n = left.get(line) ?? 0;
    if (n === 0) return true;
    left.set(line, n - 1);
    return false;
  });
};

/**
 * Ours against the reference after normalization: equal, or where they
 * first part (1-based normalized line) and the lines only one side has
 * (a multiset difference: order-only changes show as `reordered`).
 */
const diffMdp = (ours, reference, { sample = 20 } = {}) => {
  const a = normalizeMdp(ours);
  const b = normalizeMdp(reference);
  const equal = a.length === b.length && a.every((line, i) => line === b[i]);
  if (equal) return { equal, lines: { ours: a.length, reference: b.length } };
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first])
    first += 1;
  const onlyOurs = missingFrom(a, b);
  const onlyReference = missingFrom(b, a);
  return {
    equal,
    lines: { ours: a.length, reference: b.length },
    firstDifference: {
      line: first + 1,
      ours: a[first] ?? null,
      reference: b[first] ?? null,
    },
    reordered: onlyOurs.length === 0 && onlyReference.length === 0,
    onlyOurs: { count: onlyOurs.length, sample: onlyOurs.slice(0, sample) },
    onlyReference: {
      count: onlyReference.length,
      sample: onlyReference.slice(0, sample),
    },
  };
};

// ---------------------------------------------------------------------------
// PCTL: byte equality
// ---------------------------------------------------------------------------

/** Byte equality of two texts; where they first differ when they don't. */
const compareBytes = (ours, reference) => {
  const a = Buffer.from(ours, 'utf8');
  const b = Buffer.from(reference, 'utf8');
  if (a.equals(b)) return { equal: true, bytes: a.length };
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at += 1;
  return {
    equal: false,
    bytes: { ours: a.length, reference: b.length },
    firstDifference: at,
    ours: ours,
    reference: reference,
  };
};

// ---------------------------------------------------------------------------
// eval_formula.sh: lines as a set (#34 D15)
// ---------------------------------------------------------------------------

/**
 * An eval_formula.sh's parts whose order upstream doesn't fix (it builds
 * them from a HashMap): its non-empty lines, and in the `sed` line each
 * `-e "s/…/…/g"` option on its own. Counted, so a repeated part still counts.
 */
const evalScriptParts = (script) =>
  script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const options = [...line.matchAll(/-e\s+"[^"]*"/g)].map(([option]) =>
        option.replace(/\s+/g, ' '),
      );
      if (!line.startsWith('sed') || options.length === 0) return [line];
      // the command around the options, then each option
      const rest = line.replace(/-e\s+"[^"]*"/g, '').replace(/\s+/g, ' ');
      return [
        `sed:${rest}`,
        ...options.map((option) => `sed-option:${option}`),
      ];
    });

/** Two eval_formula.sh files as sets of parts (evalScriptParts): equal, or what only one has. */
const compareLineSets = (ours, reference, { sample = 20 } = {}) => {
  const a = evalScriptParts(ours);
  const b = evalScriptParts(reference);
  const onlyOurs = missingFrom(a, b);
  const onlyReference = missingFrom(b, a);
  return {
    equal: onlyOurs.length === 0 && onlyReference.length === 0,
    parts: { ours: a.length, reference: b.length },
    onlyOurs: { count: onlyOurs.length, sample: onlyOurs.slice(0, sample) },
    onlyReference: {
      count: onlyReference.length,
      sample: onlyReference.slice(0, sample),
    },
  };
};

// ---------------------------------------------------------------------------
// Formulas: lib's evaluator (engines/goda/formula.ts), one copy for the
// engine's tests and the stress test
// ---------------------------------------------------------------------------

const {
  close,
  compareFormulas,
  compileFormula,
  evalFormulaValues,
  evaluate,
  formulaText,
  random,
  SEED,
  TOLERANCE,
} = require('../../packages/lib/out/index.js');

module.exports = {
  close,
  compareBytes,
  compareFormulas,
  compareLineSets,
  compileFormula,
  diffMdp,
  evalFormulaValues,
  evalScriptParts,
  evaluate,
  formulaText,
  normalizeMdp,
  random,
  SEED,
  TOLERANCE,
};

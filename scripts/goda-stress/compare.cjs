/**
 * The GODA stress test's comparisons (goal-controller#35), engine-free:
 * an MDP against the reference after whitespace normalization, PCTL files
 * byte for byte, and the parametric formulas numerically.
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
// Formulas: parse, evaluate, compare numerically
// ---------------------------------------------------------------------------

/** A formula file's expression: its lines without `//` comments, joined. */
const formulaText = (file) =>
  file
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .join('')
    .trim();

const TOKEN =
  /\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|(.))/gy;
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4, neg: 3 };
const RIGHT = new Set(['^', 'neg']);

/**
 * A formula (`+ - * / ^`, unary minus, parentheses, numbers, variables)
 * compiled to postfix, without recursion (the references nest deeply).
 * Throws on a malformed formula.
 */
const compileFormula = (source) => {
  const text = formulaText(source);
  if (!text) throw new Error('empty formula');
  const output = [];
  const operators = [];
  const variables = new Set();
  // whether the next token starts an operand (so a '-' is unary)
  let operand = true;
  TOKEN.lastIndex = 0;
  const popWhile = (test) => {
    while (operators.length && test(operators[operators.length - 1]))
      output.push({ op: operators.pop() });
  };
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (!match) throw new Error(`unexpected input at ${at}`);
    const [, name, number, symbol] = match;
    if (name !== undefined || number !== undefined) {
      if (!operand)
        throw new Error(`missing operator before ${match[0].trim()} at ${at}`);
      if (name !== undefined) {
        variables.add(name);
        output.push({ variable: name });
      } else output.push({ value: Number(number) });
      operand = false;
    } else if (symbol === undefined) {
      break; // trailing blanks
    } else if (symbol === '(') {
      if (!operand) throw new Error(`missing operator before ( at ${at}`);
      operators.push('(');
    } else if (symbol === ')') {
      if (operand) throw new Error(`missing operand before ) at ${at}`);
      popWhile((top) => top !== '(');
      if (operators.pop() !== '(') throw new Error(`unbalanced ) at ${at}`);
    } else if (symbol in PRECEDENCE) {
      let op = symbol;
      if (operand) {
        if (symbol === '+') continue; // unary plus
        if (symbol !== '-')
          throw new Error(`missing operand before ${symbol} at ${at}`);
        op = 'neg';
      }
      popWhile(
        (top) =>
          top !== '(' &&
          (PRECEDENCE[top] > PRECEDENCE[op] ||
            (PRECEDENCE[top] === PRECEDENCE[op] && !RIGHT.has(op))),
      );
      operators.push(op);
      operand = true;
    } else throw new Error(`unexpected ${JSON.stringify(symbol)} at ${at}`);
  }
  if (operand) throw new Error('missing operand at the end');
  while (operators.length) {
    const op = operators.pop();
    if (op === '(') throw new Error('unbalanced (');
    output.push({ op });
  }
  return { program: output, variables: [...variables].sort() };
};

/** A compiled formula's value; every variable must have one. */
const evaluate = ({ program }, values) => {
  const stack = [];
  for (const step of program) {
    if ('value' in step) stack.push(step.value);
    else if ('variable' in step) {
      const value = values[step.variable];
      if (value === undefined) throw new Error(`no value for ${step.variable}`);
      stack.push(value);
    } else if (step.op === 'neg') stack.push(-stack.pop());
    else {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(
        step.op === '+'
          ? a + b
          : step.op === '-'
            ? a - b
            : step.op === '*'
              ? a * b
              : step.op === '/'
                ? a / b
                : a ** b,
      );
    }
  }
  return stack[0];
};

/** The values `eval_formula.sh` gives its variables (`NAME="0.99";`). */
const evalFormulaValues = (script) => {
  const values = {};
  for (const [, name, value] of script.matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"\s*;?\s*$/gm,
  ))
    values[name] = Number(value);
  return values;
};

/** A seeded PRNG (mulberry32): the same points on every run. */
const random = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SEED = 35;
const TOLERANCE = 1e-9;
/** Agree within 1e-9, relative to the larger value once it exceeds 1. */
const close = (a, b, tolerance = TOLERANCE) =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Ours against the reference: the same variables, and the same value at the
 * eval_formula.sh point (left out, and said so, when the script doesn't give
 * every variable a value) and at `points` seeded random points in [0,1].
 */
const compareFormulas = (
  ours,
  reference,
  { evalValues = {}, points = 100, seed = SEED, tolerance = TOLERANCE } = {},
) => {
  let a;
  let b;
  try {
    a = compileFormula(ours);
  } catch (error) {
    return { equal: false, error: `ours: ${error.message}` };
  }
  try {
    b = compileFormula(reference);
  } catch (error) {
    return { equal: false, error: `reference: ${error.message}` };
  }
  const onlyOurs = a.variables.filter((v) => !b.variables.includes(v));
  const onlyReference = b.variables.filter((v) => !a.variables.includes(v));
  const variables = [...new Set([...a.variables, ...b.variables])].sort();
  const next = random(seed);
  const samples = [
    { point: 'eval_formula.sh', values: evalValues },
    ...Array.from({ length: points }, (_, i) => ({
      point: `random ${i + 1}`,
      values: Object.fromEntries(variables.map((v) => [v, next()])),
    })),
  ];
  const mismatches = [];
  let evaluated = 0;
  // the reference's own script may not give every parameter a value (BSN's):
  // that point is left out and said so, the random points still compare
  let evalPointMissing = [];
  for (const { point, values } of samples) {
    const missing = variables.filter((v) => values[v] === undefined);
    if (missing.length) {
      evalPointMissing = missing;
      continue;
    }
    const x = evaluate(a, values);
    const y = evaluate(b, values);
    evaluated += 1;
    if (!close(x, y, tolerance))
      mismatches.push({ point, ours: x, reference: y, difference: x - y });
  }
  return {
    equal:
      mismatches.length === 0 &&
      onlyOurs.length === 0 &&
      onlyReference.length === 0,
    variables: { count: variables.length, onlyOurs, onlyReference },
    points: evaluated,
    ...(evalPointMissing.length > 0 && {
      evalPoint: { skipped: true, missing: evalPointMissing },
    }),
    tolerance,
    mismatches: { count: mismatches.length, sample: mismatches.slice(0, 5) },
  };
};

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

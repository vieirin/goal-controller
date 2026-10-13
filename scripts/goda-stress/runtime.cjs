/**
 * The checks of a model the BSN runtime consumes (SA-BSN, #93, #95). The
 * runtime loads two one-line files, `reliability.formula` and `cost.formula`
 * (`DataAccess::fetch_formula`), compiles them with Lepton, and finds its
 * components by scanning the formulas' terms by prefix (ReliabilityEngine.cpp
 * lines 63–85, 206–209, 324; CostEngine.cpp likewise with `W_`). So:
 *
 * - **runtimePair**: ours byte-identical to upstream's (no trailing newline);
 * - **termContract**: each formula's identifiers are exactly its prefixes ×
 *   the components: the model's leaves are the runtime's component set;
 * - **evaluationParity**: lib's evaluator on ours against the runtime's
 *   semantics in plain arithmetic (reliability Π CTX·F·R, cost Σ CTX·W) and,
 *   when `bc` is on PATH, against `bc` on the same text, at three value sets.
 */
const { spawnSync } = require('child_process');
const {
  close,
  compareBytes,
  compileFormula,
  evaluate,
} = require('./compare.cjs');

const PREFIXES = { reliability: ['CTX_', 'F_', 'R_'], cost: ['CTX_', 'W_'] };
const KINDS = Object.keys(PREFIXES);
/** Parity's tolerance (#95): tighter than the reference comparison's 1e-9. */
const PARITY_TOLERANCE = 1e-12;

/** The identifiers a formula must have: its prefixes × the components, sorted. */
const expectedTerms = (kind, components) =>
  PREFIXES[kind]
    .flatMap((prefix) => components.map((id) => `${prefix}${id}`))
    .sort();

/** A formula's identifiers against the contract: what's extra, what's missing. */
const termContract = (kind, text, components) => {
  let variables;
  try {
    ({ variables } = compileFormula(text));
  } catch (error) {
    return { equal: false, error: error.message };
  }
  const expected = expectedTerms(kind, components);
  const extra = variables.filter((v) => !expected.includes(v));
  const missing = expected.filter((v) => !variables.includes(v));
  return {
    equal: extra.length === 0 && missing.length === 0,
    terms: variables.length,
    extra,
    missing,
  };
};

/** The runtime's semantics of an all-AND sequence: Π CTX·F·R and Σ CTX·W. */
const SEMANTICS = {
  reliability: (values, components) =>
    components.reduce(
      (product, id) =>
        product * values[`CTX_${id}`] * values[`F_${id}`] * values[`R_${id}`],
      1,
    ),
  cost: (values, components) =>
    components.reduce(
      (sum, id) => sum + values[`CTX_${id}`] * values[`W_${id}`],
      0,
    ),
};

/**
 * The three value sets of #95: eval_formula.sh's values (param.zip's),
 * the ReliabilityEngine's and CostEngine's initial strategy (CTX_ 0, R_, F_
 * and W_ 1: ReliabilityEngine.cpp 82–86, CostEngine.cpp 85–86), and
 * eval_formula.sh's with one component deactivated (its CTX_ 0; SA-BSN's
 * G3_T1_5, the `Unknown_sensor` leaf).
 */
const valueSets = (evalValues, { components, deactivated }) => {
  const initial = Object.fromEntries(
    components.flatMap((id) => [
      [`CTX_${id}`, 0],
      [`F_${id}`, 1],
      [`R_${id}`, 1],
      [`W_${id}`, 1],
    ]),
  );
  return {
    evalFormula: evalValues,
    initialStrategy: initial,
    [`deactivated ${deactivated}`]: {
      ...evalValues,
      [`CTX_${deactivated}`]: 0,
    },
  };
};

const hasBc = () =>
  spawnSync(process.platform === 'win32' ? 'where' : 'which', ['bc']).status ===
  0;

/** `bc` on a formula with its identifiers replaced by values, as eval_formula.sh does. */
const bcValue = (text, values) => {
  const expression = text.trim().replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => {
    if (values[name] === undefined) throw new Error(`no value for ${name}`);
    return `(${values[name]})`;
  });
  const run = spawnSync('bc', ['-q'], {
    input: `scale=20;${expression}\n`,
    encoding: 'utf8',
  });
  if (run.status !== 0 || run.stderr)
    throw new Error(`bc: ${run.stderr || run.status}`);
  return Number(run.stdout.replace(/\\\n/g, '').trim());
};

/**
 * Lib's evaluator against the semantics (and bc) at each value set, for one
 * formula; `reference` (upstream's) is evaluated alongside, for the record.
 */
const parity = (kind, text, reference, sets, components, { bc }) => {
  let ours;
  let theirs;
  try {
    ours = compileFormula(text);
    theirs = reference ? compileFormula(reference) : null;
  } catch (error) {
    return { equal: false, error: error.message };
  }
  const points = Object.entries(sets).map(([point, values]) => {
    const lib = evaluate(ours, values);
    const semantics = SEMANTICS[kind](values, components);
    const viaBc = bc ? bcValue(text, values) : undefined;
    return {
      point,
      lib,
      semantics,
      ...(bc && { bc: viaBc }),
      ...(theirs && { reference: evaluate(theirs, values) }),
      equal:
        close(lib, semantics, PARITY_TOLERANCE) &&
        (!bc || close(lib, viaBc, PARITY_TOLERANCE)),
    };
  });
  return { equal: points.every((p) => p.equal), points };
};

const status = (ok) => (ok ? 'pass' : 'fail');

/**
 * The three runtime checks on an engine output's runtime pair (`ours`, by
 * kind: an output file or undefined). Without the pair, the pair fails and
 * the other two can't run. `model`: its `components` and the one
 * `deactivated` in the third value set.
 */
const checkRuntime = (
  ours,
  { runtime, evalValues },
  model,
  { bc = hasBc() } = {},
) => {
  const { components } = model;
  const missing = KINDS.filter((kind) => !ours[kind]);
  if (missing.length) {
    const error = `no ${missing.map((kind) => `${kind}.formula`).join(' or ')} in the output (options.runtimeFormulas, #94)`;
    const unavailable = { status: 'unavailable', reason: error };
    return {
      runtimePair: { status: 'fail', error },
      termContract: unavailable,
      evaluationParity: unavailable,
    };
  }
  const pair = Object.fromEntries(
    KINDS.map((kind) => [kind, compareBytes(ours[kind].text, runtime[kind])]),
  );
  const terms = Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      termContract(kind, ours[kind].text, components),
    ]),
  );
  const sets = valueSets(evalValues, model);
  const evaluations = Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      parity(kind, ours[kind].text, runtime[kind], sets, components, { bc }),
    ]),
  );
  const all = (results) => Object.values(results).every((r) => r.equal);
  return {
    runtimePair: { status: status(all(pair)), files: pair },
    termContract: { status: status(all(terms)), formulas: terms },
    evaluationParity: {
      status: status(all(evaluations)),
      tolerance: PARITY_TOLERANCE,
      bc,
      formulas: evaluations,
    },
  };
};

/** The runtime checks' names, in the report's order. */
const RUNTIME_CHECKS = ['runtimePair', 'termContract', 'evaluationParity'];

module.exports = {
  PARITY_TOLERANCE,
  PREFIXES,
  RUNTIME_CHECKS,
  SEMANTICS,
  bcValue,
  checkRuntime,
  expectedTerms,
  termContract,
  valueSets,
};

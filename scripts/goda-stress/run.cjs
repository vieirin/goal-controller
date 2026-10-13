#!/usr/bin/env node
/**
 * The GODA-MDP stress test (goal-controller#35), one command:
 *
 *   pnpm stress:goda                   # builds the packages, then runs this
 *   node scripts/goda-stress/run.cjs [--save-baseline] [--strict] [--no-build-check]
 *
 * 1. fetches pistarGODA-MDP's examples at the pinned commit, and SA-BSN's
 *    models from lesunb/bsn (fetch.cjs);
 * 2. runs #32's checks on each of the seven models, and on SA-BSN with both
 *    generator versions plus its runtime checks (checks.cjs, runtime.cjs),
 *    through the GODA engine adapter (engine.cjs);
 * 3. checks the other engines against the language snapshot's baseline
 *    (snapshot.cjs; `--save-baseline` takes it, on the base commit);
 * 4. writes a JSON result per model and SUMMARY.md to .cache/goda/results/.
 *
 * Exits non-zero only on a regression in the other engines. A failure on a
 * model whose issue hasn't landed is expected and reported as such; one on
 * a model whose issue has (SUPPORTED) is reported as a failure, and fails
 * the run with `--strict`. A model's `informational` checks (SA-BSN's
 * comparisons with param.zip, whose generator version is unknown) never do.
 */
const fs = require('fs');
const path = require('path');
const {
  COMMIT,
  EXAMPLES,
  SA_BSN,
  fetchExamples,
  fetchSaBsn,
} = require('./fetch.cjs');
const { checkModel, strictFailures } = require('./checks.cjs');
const { godaEngine } = require('./engine.cjs');
const { markdown } = require('./report.cjs');
const { loadReferences } = require('./references.cjs');
const { checkRegressions, take } = require('./snapshot.cjs');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, '.cache', 'goda');
const RESULTS = path.join(CACHE, 'results');
const BASELINE = path.join(CACHE, 'snapshot-baseline');
/**
 * The models whose issue has landed in the stack (#32 AND and OR, #36 DM,
 * #37 Incompleteness, #38 TAS); the others' failures are expected until
 * theirs does (#39, #40; SA-BSN #94).
 */
const SUPPORTED = new Set(['AND', 'OR', 'DM', 'Incompleteness', 'TAS']);

const pkg = (name) => path.join(ROOT, 'packages', name);
const load = () => ({
  lib: require(path.join(pkg('lib'), 'out/index.js')),
  language: require(path.join(pkg('goal-language'), 'out/cjs/index.cjs')),
  goalTree: require(path.join(pkg('goal-tree'), 'out/index.js')),
  core: require(
    require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
  ),
});

/** A model's failures are expected until its issue lands. */
const withExpectations = (name, checks) =>
  SUPPORTED.has(name)
    ? checks
    : Object.fromEntries(
        Object.entries(checks).map(([key, check]) => [
          key,
          check.status === 'fail'
            ? { ...check, status: 'expected-fail' }
            : check,
        ]),
      );

const main = async () => {
  const args = new Set(process.argv.slice(2));
  if (args.has('--save-baseline')) {
    take(BASELINE);
    console.log(`baseline saved in ${path.relative(ROOT, BASELINE)}`);
    return 0;
  }
  const fetched = await fetchExamples();
  console.log(
    `examples: ${fetched.files} files (${fetched.downloaded} downloaded)`,
  );
  const saBsn = await fetchSaBsn();
  console.log(`sa-bsn: ${saBsn.files} files (${saBsn.downloaded} downloaded)`);
  const deps = load();
  const engine = godaEngine(deps.lib);
  // the engines write their reports to the console: not the harness's output
  const { log, error, warn } = console;
  const quiet = () => {
    console.log = console.error = console.warn = () => {};
  };
  const loud = () => Object.assign(console, { log, error, warn });

  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const results = [];
  for (const reference of loadReferences(EXAMPLES, SA_BSN.directory)) {
    quiet();
    let checks;
    try {
      checks = withExpectations(
        reference.name,
        checkModel(deps, engine, reference, {
          build: !args.has('--no-build-check'),
        }),
      );
    } finally {
      loud();
    }
    const result = {
      model: reference.name,
      issue: reference.issue,
      variant: reference.variant,
      ...(reference.informational && {
        informational: reference.informational,
      }),
      checks,
    };
    results.push(result);
    // a model run with several generator versions: a file per version
    const id = reference.variants
      ? `${reference.name}-${reference.variant}`
      : reference.name;
    fs.writeFileSync(
      path.join(RESULTS, `${id}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    log(
      `${id.padEnd(15)} ${Object.entries(checks)
        .map(([name, check]) => `${name}:${check.status}`)
        .join(' ')}`,
    );
  }

  const regressions = checkRegressions({
    baseline: BASELINE,
    current: path.join(CACHE, 'snapshot-current'),
  });
  log(`regressions: ${regressions.status}`);
  const supportedFailures = strictFailures(results, SUPPORTED);
  const exitCode =
    regressions.status === 'fail' ||
    (args.has('--strict') && supportedFailures.length > 0)
      ? 1
      : 0;
  const summary = {
    commit: COMMIT,
    saBsnCommit: SA_BSN.commit,
    engine: !!engine,
    generatedAt: new Date().toISOString(),
    results,
    regressions,
    exitCode,
  };
  fs.writeFileSync(
    path.join(RESULTS, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(RESULTS, 'SUMMARY.md'), markdown(summary));
  log(
    `results in ${path.relative(ROOT, RESULTS)} (SUMMARY.md, one JSON per model)`,
  );
  return exitCode;
};

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(2);
  },
);

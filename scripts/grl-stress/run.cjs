#!/usr/bin/env node
/**
 * The GRL stress test (goal-controller#106), one command:
 *
 *   pnpm stress:grl                    # builds lib, then runs this
 *   node scripts/grl-stress/run.cjs [--oracle] [--strict]
 *
 * 1. fetches the upstream seeds at their pinned commits (fetch.cjs) and
 *    takes the committed ones from examples/grl/ (references.cjs);
 * 2. with `--oracle`, evaluates the fetched seeds with jUCMNav in Docker
 *    into .cache/grl/reference/ (never on the host);
 * 3. imports each seed, checks its counts and its contributions, and
 *    evaluates its strategies against the reference (seed.cjs);
 * 4. writes each seed's model back as a `.jucm` and imports it again; with
 *    `--oracle`, jUCMNav evaluates the written files too, each against its
 *    seed's reference (native.cjs, goal-controller#144);
 * 5. writes a JSON result per seed and SUMMARY.md to .cache/grl/results/.
 *
 * Exits non-zero only with `--strict`, on a failure of a committed seed. A
 * fetched seed's failures are reported, never fatal.
 */
const fs = require('fs');
const path = require('path');
const { CACHE, SOURCES, fetchSeeds } = require('./fetch.cjs');
const {
  committedSeeds,
  loadReference,
  oracle,
  runOracle,
  withReference,
} = require('./references.cjs');
const {
  NATIVE_REFERENCE,
  checkNative,
  writeNativeSeeds,
} = require('./native.cjs');
const { checkSeed } = require('./seed.cjs');
const { markdown } = require('./report.cjs');

const ROOT = path.join(__dirname, '..', '..');
const RESULTS = path.join(CACHE, 'results');

const pkg = (name) => path.join(ROOT, 'packages', name);
const load = () => ({
  lib: require(path.join(pkg('lib'), 'out/index.js')),
  // parsePistar is @istar-ts/core's, as goal-tree resolves it
  core: require(
    require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
  ),
});

/**
 * Whether a seed's result fails: a check of it, or of a strategy's run; a
 * committed seed that is missing fails too (a fetched one is skipped).
 */
const failed = (result) =>
  result.missing
    ? result.committed
    : Object.values(result.checks).some((check) => check.status === 'fail') ||
      result.strategies.some((strategy) =>
        Object.values(strategy.runs).some((run) => run.status === 'fail'),
      );

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const fetched = await fetchSeeds();
  console.log(
    `upstream: ${fetched.seeds.length} seeds (${fetched.downloaded} downloaded)`,
  );
  const upstream = fetched.seeds.map(withReference);
  if (args.has('--oracle')) runOracle(upstream);
  const seeds = [...committedSeeds(), ...upstream];
  const deps = load();
  if (args.has('--oracle')) {
    fs.rmSync(NATIVE_REFERENCE, { recursive: true, force: true });
    oracle(writeNativeSeeds(deps.lib, seeds), NATIVE_REFERENCE);
  }

  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const results = [];
  for (const seed of seeds) {
    const base = {
      seed: seed.id,
      origin: seed.origin,
      committed: seed.committed,
    };
    const text = fs.existsSync(seed.file)
      ? fs.readFileSync(seed.file, 'utf8')
      : null;
    const reference = text === null ? null : loadReference(seed);
    const checked = text === null ? null : checkSeed(deps, text, reference);
    const result = checked
      ? {
          ...base,
          ...checked,
          checks: {
            ...checked.checks,
            native: checkNative(deps.lib, seed.id, text, reference),
          },
        }
      : {
          ...base,
          missing: `seed missing (${path.relative(ROOT, seed.file)})`,
        };
    results.push(result);
    fs.writeFileSync(
      path.join(RESULTS, `${seed.id}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log(
      `${seed.id.padEnd(40)} ${
        result.missing ??
        Object.entries(result.checks)
          .map(([name, check]) => `${name}:${check.status}`)
          .join(' ')
      }`,
    );
  }

  const committedFailures = results.filter(
    (result) => result.committed && failed(result),
  );
  const exitCode = args.has('--strict') && committedFailures.length ? 1 : 0;
  const summary = {
    sources: SOURCES.map((s) => `${s.repo}@${s.commit.slice(0, 8)}`),
    generatedAt: new Date().toISOString(),
    exitCode,
    results,
  };
  fs.writeFileSync(path.join(RESULTS, 'SUMMARY.md'), markdown(summary));
  console.log(
    `results in ${path.relative(ROOT, RESULTS)} (SUMMARY.md, one JSON per seed)`,
  );
  if (committedFailures.length)
    console.log(
      `committed seeds failing: ${committedFailures.map((r) => r.seed).join(', ')}`,
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

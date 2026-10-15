#!/usr/bin/env node
/**
 * The iStar-DT stress test (goal-controller#119), one command:
 *
 *   pnpm stress:istardt                    # builds lib, then runs this
 *   node scripts/istardt-stress/run.cjs [--oracle] [--strict]
 *
 * 1. fetches dtx2dtg's nine golden pairs at their pinned commit
 *    (fetch.cjs) and takes the committed seeds from examples/istardt/
 *    (projects.cjs);
 * 2. imports each seed, checks it, writes its DT-Golog file and compares
 *    it with the golden one after the header (seed.cjs);
 * 3. with `--oracle`, runs ours and the golden files with DT-Golog in
 *    Docker (never on the host) and compares their utility and policy
 *    (oracle.cjs);
 * 4. writes a JSON result per seed and SUMMARY.md to .cache/istardt/results/.
 *
 * Exits non-zero only with `--strict`, on a failure of a committed seed. A
 * fetched seed's failures are reported, never fatal.
 */
const fs = require('fs');
const path = require('path');
const { CACHE, ISTARDT, fetchFiles } = require('./fetch.cjs');
const { committedSeeds, fetchedSeeds } = require('./projects.cjs');
const { checkSeed, oracleCheck } = require('./seed.cjs');
const { oracleOf, readResult, runOracle, TRIALS } = require('./oracle.cjs');
const { markdown } = require('./report.cjs');

const ROOT = path.join(__dirname, '..', '..');
const RESULTS = path.join(CACHE, 'results');

const pkg = (name) => path.join(ROOT, 'packages', name);
const load = () => ({
  lib: require(path.join(pkg('lib'), 'out/index.js')),
  // parsePistar is @istar-ts/core's, as lib resolves it
  core: require(require.resolve('@istar-ts/core', { paths: [pkg('lib')] })),
});

const failed = (result) =>
  result.missing
    ? result.committed
    : Object.values(result.checks).some((check) => check?.status === 'fail');

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const fetched = await fetchFiles();
  console.log(
    `upstream: ${fetched.files} files (${fetched.downloaded} downloaded)`,
  );
  const seeds = [...committedSeeds(), ...fetchedSeeds()];
  const deps = load();

  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const results = seeds.map((seed) => {
    const base = { seed: seed.id, committed: seed.committed };
    if (!fs.existsSync(seed.source))
      return {
        ...base,
        missing: `seed missing (${path.relative(ROOT, seed.source)})`,
      };
    const { checks, program } = checkSeed(deps, seed);
    return { ...base, checks, program };
  });

  if (args.has('--oracle'))
    runOracle(
      results
        .filter((r) => r.program)
        .map((r) => {
          const seed = seeds.find((s) => s.id === r.seed);
          return {
            id: r.seed,
            ours: r.program,
            golden:
              seed.golden && fs.existsSync(seed.golden)
                ? fs.readFileSync(seed.golden, 'utf8')
                : null,
          };
        }),
    );
  for (const result of results) {
    if (result.missing) continue;
    const seed = seeds.find((s) => s.id === result.seed);
    // a previous run's results are not this one's
    const oracle = args.has('--oracle')
      ? oracleOf(result.seed)
      : { ours: null, golden: null, trials: TRIALS[result.seed] ?? null };
    result.trials = oracle.trials;
    result.checks.oracle = oracleCheck(
      seed,
      oracle,
      seed.utility ? readResult(seed.utility) : null,
    );
    delete result.program;
    fs.writeFileSync(
      path.join(RESULTS, `${result.seed}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log(
      `${result.seed.padEnd(28)} ${Object.entries(result.checks)
        .map(([name, check]) => `${name}:${check.status}`)
        .join(' ')}`,
    );
  }

  const committedFailures = results.filter(
    (result) => result.committed && failed(result),
  );
  const exitCode = args.has('--strict') && committedFailures.length ? 1 : 0;
  fs.writeFileSync(
    path.join(RESULTS, 'SUMMARY.md'),
    markdown({
      sources: [`${ISTARDT.repo}@${ISTARDT.commit.slice(0, 8)}`],
      generatedAt: new Date().toISOString(),
      exitCode,
      oracle: args.has('--oracle'),
      results,
    }),
  );
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

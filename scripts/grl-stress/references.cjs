/**
 * The seeds and their reference evaluations (goal-controller#106).
 *
 * - **Committed seeds** (`COMMITTED`) are read from the repository, each
 *   with its reference at `examples/projects/<project>/reference/evaluations.csv`.
 * - **Fetched seeds** (fetch.cjs) keep the oracle's CSV in
 *   `.cache/grl/reference/<id>.csv`, written by `runOracle` (`--oracle`).
 *
 * The oracle is jUCMNav itself, in Docker: `docker/jucmnav/run.sh <seeds>
 * <out>` writes a CSV per `.jucm`. Nothing runs on the host.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { CACHE } = require('./fetch.cjs');
const { readReference } = require('./compare.cjs');

const ROOT = path.join(__dirname, '..', '..');
const PROJECTS = path.join(ROOT, 'examples', 'projects');
const REFERENCE = path.join(CACHE, 'reference');
const ORACLE_SEEDS = path.join(CACHE, 'oracle-seeds');

/** The committed seeds: a project directory and its `.jucm`. */
const COMMITTED = [
  { id: 'grl-smart-home', file: 'SmartHome2.jucm' },
  { id: 'grl-own', file: 'grl-own.jucm' },
];

const committedSeeds = () =>
  COMMITTED.map(({ id, file }) => ({
    id,
    origin: `examples/projects/${id}`,
    committed: true,
    file: path.join(PROJECTS, id, file),
    reference: path.join(PROJECTS, id, 'reference', 'evaluations.csv'),
  }));

const withReference = (seed) => ({
  ...seed,
  committed: false,
  reference: path.join(REFERENCE, `${seed.id}.csv`),
});

/**
 * A seed's reference, read; `{ skip }` when there is none. A committed
 * seed's missing reference is `fatal` (its evaluations would go unchecked),
 * and so is one that is there but unusable (the oracle didn't load the
 * seed): the seed in the repository isn't one jUCMNav reads.
 */
const loadReference = (seed) => {
  if (!fs.existsSync(seed.reference))
    return seed.committed
      ? {
          skip: `no reference (${path.relative(ROOT, seed.reference)} is missing)`,
          fatal: true,
        }
      : { skip: 'no reference (run --oracle)' };
  const reference = readReference(fs.readFileSync(seed.reference, 'utf8'));
  return reference.skip && seed.committed
    ? { ...reference, fatal: true }
    : reference;
};

/**
 * Runs the oracle on the fetched seeds: each copied as `<id>.jucm` into one
 * directory (run.sh reads a flat directory), the CSVs into REFERENCE.
 */
const runOracle = (seeds) => {
  fs.rmSync(ORACLE_SEEDS, { recursive: true, force: true });
  fs.mkdirSync(ORACLE_SEEDS, { recursive: true });
  for (const seed of seeds)
    fs.copyFileSync(seed.file, path.join(ORACLE_SEEDS, `${seed.id}.jucm`));
  fs.mkdirSync(REFERENCE, { recursive: true });
  execFileSync(
    path.join(ROOT, 'docker', 'jucmnav', 'run.sh'),
    [ORACLE_SEEDS, REFERENCE],
    { stdio: 'inherit' },
  );
};

module.exports = {
  COMMITTED,
  REFERENCE,
  committedSeeds,
  loadReference,
  runOracle,
  withReference,
};

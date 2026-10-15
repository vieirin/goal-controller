#!/usr/bin/env node
/**
 * Downloads the GRL stress test's upstream seeds (goal-controller#106) at
 * pinned commits into a gitignored cache, `.cache/grl/<commit>/<path>` at
 * the repository root. Single raw files, no clones (GoalCat's repository is
 * 1.7 GB):
 *
 * - JUCMNAV/TURNtoURN: every `.jucm` under `Expected Outputs/` (the GRL
 *   constructs, the UCM-only ones, each with its `-autolayout` twin);
 * - dcalegar/GoalCat: four goal models under `data/goals/`.
 *
 *   node scripts/grl-stress/fetch.cjs          # skips files already cached
 *   node scripts/grl-stress/fetch.cjs --force  # downloads them again
 *
 * Needs network access the first time only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, '.cache', 'grl');

const SOURCES = [
  {
    name: 'turn',
    repo: 'JUCMNAV/TURNtoURN',
    commit: '4fac7d36b08ff1eeb41f7b74a9e54e2aec5c62c7',
    prefix: 'Expected Outputs/',
    // listed from the repository's tree at the commit
    files: null,
  },
  {
    name: 'goalcat',
    repo: 'dcalegar/GoalCat',
    commit: '636e482848d46d131c860c0784fbd891caa7eb64',
    prefix: 'data/goals/',
    files: [
      'rtfm_goal_model.jucm',
      'rtfm_mini_goal_model.jucm',
      'sepsis_goal_model.jucm',
      'bpic2019_goal_model.jucm',
    ],
  },
];

const get = async (url, as) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'goal-controller-grl-stress' },
  });
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return as === 'json' ? response.json() : response.text();
};

const directoryOf = (source) => path.join(CACHE, source.commit);

/** A source's `.jucm` files at its commit: their paths under its prefix. */
const listing = async (source) => {
  if (source.files) return source.files;
  const index = path.join(directoryOf(source), 'tree.json');
  if (fs.existsSync(index)) return JSON.parse(fs.readFileSync(index, 'utf8'));
  const tree = await get(
    `https://api.github.com/repos/${source.repo}/git/trees/${source.commit}?recursive=1`,
    'json',
  );
  if (tree.truncated) throw new Error('the repository tree came truncated');
  const files = tree.tree
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        entry.path.startsWith(source.prefix) &&
        entry.path.endsWith('.jucm'),
    )
    .map((entry) => entry.path.slice(source.prefix.length));
  fs.mkdirSync(directoryOf(source), { recursive: true });
  fs.writeFileSync(index, `${JSON.stringify(files, null, 2)}\n`);
  return files;
};

/**
 * The fetched seeds, `{ id, origin, file }` each: `id` is
 * `<source>-<file name without .jucm>` (`turn-goal-autolayout`,
 * `goalcat-rtfm_goal_model`), unique across the sources.
 */
const fetchSeeds = async ({ force = false } = {}) => {
  const seeds = [];
  let downloaded = 0;
  for (const source of SOURCES) {
    for (const file of await listing(source)) {
      const target = path.join(directoryOf(source), source.prefix, file);
      if (force || !fs.existsSync(target)) {
        const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${`${source.prefix}${file}`
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await get(url, 'text'));
        downloaded += 1;
      }
      seeds.push({
        id: `${source.name}-${path.basename(file, '.jucm')}`,
        origin: `${source.repo}@${source.commit.slice(0, 8)}`,
        file: target,
      });
    }
  }
  return { seeds, downloaded };
};

module.exports = { CACHE, SOURCES, fetchSeeds };

if (require.main === module)
  fetchSeeds({ force: process.argv.includes('--force') }).then(
    ({ seeds, downloaded }) =>
      console.log(
        `${seeds.length} seeds in ${path.relative(ROOT, CACHE)} (${downloaded} downloaded)`,
      ),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );

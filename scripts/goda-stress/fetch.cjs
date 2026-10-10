#!/usr/bin/env node
/**
 * Downloads pistarGODA-MDP's examples (docs/examples/**) at the pinned commit
 * into a gitignored cache, `.cache/goda/<commit>/` at the repository root.
 * The upstream repository has no licence file, so its models are fetched, not
 * committed (decision D1 in goal-controller#34).
 *
 *   node scripts/goda-stress/fetch.cjs          # skips files already cached
 *   node scripts/goda-stress/fetch.cjs --force  # downloads them again
 *
 * Needs network access the first time only.
 */
const fs = require('fs');
const path = require('path');

const REPO = 'lesunb/pistarGODA-MDP';
const COMMIT = 'c8519f703a2337980a041fdbf09235ab51744fb4';
const PREFIX = 'docs/examples/';
const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, '.cache', 'goda', COMMIT);
const EXAMPLES = path.join(CACHE, 'examples');

const get = async (url, as) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'goal-controller-goda-stress' },
  });
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return as === 'json' ? response.json() : response.text();
};

/** The examples' files at the commit: their paths under docs/examples/. */
const listing = async () => {
  const index = path.join(CACHE, 'tree.json');
  if (fs.existsSync(index)) return JSON.parse(fs.readFileSync(index, 'utf8'));
  const tree = await get(
    `https://api.github.com/repos/${REPO}/git/trees/${COMMIT}?recursive=1`,
    'json',
  );
  if (tree.truncated) throw new Error('the repository tree came truncated');
  const files = tree.tree
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith(PREFIX))
    .map((entry) => entry.path.slice(PREFIX.length));
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(index, `${JSON.stringify(files, null, 2)}\n`);
  return files;
};

const fetchExamples = async ({ force = false } = {}) => {
  const files = await listing();
  let downloaded = 0;
  for (const file of files) {
    const target = path.join(EXAMPLES, file);
    if (!force && fs.existsSync(target)) continue;
    const url = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${PREFIX}${file
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await get(url, 'text'));
    downloaded += 1;
  }
  return { directory: EXAMPLES, files: files.length, downloaded };
};

module.exports = { COMMIT, REPO, EXAMPLES, fetchExamples };

if (require.main === module)
  fetchExamples({ force: process.argv.includes('--force') }).then(
    ({ directory, files, downloaded }) =>
      console.log(
        `${files} files in ${path.relative(ROOT, directory)} (${downloaded} downloaded)`,
      ),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );

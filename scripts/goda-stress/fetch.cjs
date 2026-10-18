#!/usr/bin/env node
/**
 * Downloads pistarGODA-MDP's examples (docs/examples/**) at the pinned commit
 * into a gitignored cache, `.cache/goda/<commit>/` at the repository root.
 * The upstream repository has no licence file, so its models are fetched, not
 * committed (decision D1 in goal-controller#34).
 *
 * Also SA-BSN's knowledge-repository models (lesunb/bsn, MIT; #93, #95) into
 * `.cache/goda/sa-bsn/<commit>/`: the goal model, the two formulas the runtime
 * loads and `param.zip`, unzipped into `param/`. Fetched rather than taken
 * from the seed project (#94), so the harness doesn't depend on it.
 *
 *   node scripts/goda-stress/fetch.cjs          # skips files already cached
 *   node scripts/goda-stress/fetch.cjs --force  # downloads them again
 *
 * Needs network access the first time only.
 */
const fs = require('fs');
const path = require('path');
const { unzip } = require('./zip.cjs');

const REPO = 'lesunb/pistarGODA-MDP';
const COMMIT = 'c8519f703a2337980a041fdbf09235ab51744fb4';
const PREFIX = 'docs/examples/';
const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, '.cache', 'goda', COMMIT);
const EXAMPLES = path.join(CACHE, 'examples');

const get = async (url, as) => {
  const headers = { 'User-Agent': 'goal-controller-goda-stress' };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  if (as === 'json') return response.json();
  if (as === 'buffer') return Buffer.from(await response.arrayBuffer());
  return response.text();
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

const SA_BSN = {
  repo: 'lesunb/bsn',
  commit: 'f939d3c8d5fd32c84ab2dbc38d6af9e50da315d9',
  prefix: 'src/sa-bsn/knowledge_repository/resource/models/',
  files: ['goalModel.txt', 'reliability.formula', 'cost.formula', 'param.zip'],
};
SA_BSN.directory = path.join(ROOT, '.cache', 'goda', 'sa-bsn', SA_BSN.commit);

/** SA-BSN's model files, and param.zip's eight files in `param/`. */
const fetchSaBsn = async ({ force = false } = {}) => {
  let downloaded = 0;
  for (const file of SA_BSN.files) {
    const target = path.join(SA_BSN.directory, file);
    if (!force && fs.existsSync(target)) continue;
    const url = `https://raw.githubusercontent.com/${SA_BSN.repo}/${SA_BSN.commit}/${SA_BSN.prefix}${file}`;
    fs.mkdirSync(SA_BSN.directory, { recursive: true });
    fs.writeFileSync(target, await get(url, 'buffer'));
    downloaded += 1;
  }
  const param = path.join(SA_BSN.directory, 'param');
  fs.mkdirSync(param, { recursive: true });
  const archive = unzip(
    fs.readFileSync(path.join(SA_BSN.directory, 'param.zip')),
  );
  for (const [name, data] of Object.entries(archive))
    fs.writeFileSync(path.join(param, name), data);
  return {
    directory: SA_BSN.directory,
    files: SA_BSN.files.length + Object.keys(archive).length,
    downloaded,
  };
};

module.exports = {
  COMMIT,
  REPO,
  EXAMPLES,
  SA_BSN,
  fetchExamples,
  fetchSaBsn,
};

const report = ({ directory, files, downloaded }) =>
  console.log(
    `${files} files in ${path.relative(ROOT, directory)} (${downloaded} downloaded)`,
  );

if (require.main === module) {
  const force = process.argv.includes('--force');
  fetchExamples({ force })
    .then(report)
    .then(() => fetchSaBsn({ force }))
    .then(report, (error) => {
      console.error(error.message);
      process.exit(1);
    });
}

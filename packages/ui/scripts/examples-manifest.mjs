#!/usr/bin/env node
/**
 * Builds the examples index at build/dev time: the static site has no server to
 * list examples/ from, so the list is baked in. Written as an importable JSON module
 * (services/examples.ts imports it) and also to public/ for a static URL if needed.
 *
 * Each entry is a project (lib/project's ProjectIndexEntry): a folder holding a
 * project.json is one project with its files; any other goal model is a one-model
 * project whose manifest is embedded in it. openProject reads an entry the same way
 * (packages/lib/test/dialect/project/index.test.ts checks it).
 *
 * Beside it, public/example-previews.json: each entry's model without its text
 * and properties (only what the home page's thumbnails draw), fetched once.
 *
 * --local (dev): public/examples links to examples/, so the workbench reads the
 * examples as they are on disk rather than as pushed (services/examples.ts).
 * --watch (dev): writes everything again whenever examples/ changes.
 */
import { promises as fs, watch as watchFs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { previewOf } from './examplePreview.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// examples/ at the repository root (this script runs from packages/ui)
const EXAMPLES_ROOT = path.resolve(__dirname, '..', '..', '..', 'examples');
const LIB_FILE = path.resolve(__dirname, '..', 'lib', 'examples-manifest.json');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PUBLIC_FILE = path.join(PUBLIC_DIR, 'examples.json');
const PREVIEWS_FILE = path.join(PUBLIC_DIR, 'example-previews.json');
// the examples as they are on disk, served in dev (gitignored)
const LOCAL_LINK = path.join(PUBLIC_DIR, 'examples');
const LOCAL = process.argv.includes('--local');
const WATCH = process.argv.includes('--watch');
// generated conformance models are not hand-written examples; the rest are
// a project's own folders, never walked into (a project is one entry)
const SKIP_DIRS = new Set(['generated', 'props', 'reference', 'results']);
const PROJECT_FILE = 'project.json';

const posix = (p) => p.split(path.sep).join('/');

/** Only piStar goal models (some .txt files in examples/ are PRISM sketches). */
const isGoalModel = async (file) => {
  try {
    const model = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(model.actors);
  } catch {
    return false;
  }
};

/** Every file under a project folder, from it. */
const filesUnder = async (dir) => {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      files.push(...(await filesUnder(full)).map((f) => `${entry.name}/${f}`));
    else files.push(entry.name);
  }
  return files.sort();
};

const projectFolder = async (dir, group) => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(dir, PROJECT_FILE), 'utf8'),
  );
  const root = posix(path.relative(EXAMPLES_ROOT, dir));
  return {
    path: root,
    group: group || 'examples',
    name: posix(path.relative(path.join(EXAMPLES_ROOT, group), dir)),
    form: 'file',
    ...(manifest.dialect && { dialect: manifest.dialect }),
    root,
    files: await filesUnder(dir),
    models: (manifest.models ?? []).map((model) => model.path),
    projectResources: manifest.projectResources ?? {},
    outputs: (manifest.outputs ?? []).map((output) => output.path),
  };
};

const listExamples = async (dir, group) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  if (group && entries.some((e) => e.isFile() && e.name === PROJECT_FILE))
    return [await projectFolder(dir, group)];
  const projects = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        projects.push(...(await listExamples(full, group || entry.name)));
      }
    } else if (entry.name.endsWith('.txt') && (await isGoalModel(full))) {
      projects.push({
        path: posix(path.relative(EXAMPLES_ROOT, full)),
        group: group || 'examples',
        name: posix(path.relative(path.join(EXAMPLES_ROOT, group), full)),
        form: 'embedded',
        root: posix(path.relative(EXAMPLES_ROOT, dir)),
        files: [entry.name],
        models: [entry.name],
        projectResources: {},
        outputs: [],
      });
    }
  }
  return projects;
};

/** Each entry's first model, as a preview, by the entry's path. */
const previewsOf = async (examples) => {
  const previews = {};
  for (const entry of examples) {
    const [model] = entry.models;
    if (!model) continue;
    try {
      previews[entry.path] = previewOf(
        await fs.readFile(path.join(EXAMPLES_ROOT, entry.root, model), 'utf8'),
      );
    } catch {
      // no preview: its card shows a placeholder
    }
  }
  return previews;
};

/** public/examples → examples/, in dev only: a build must not ship it twice. */
const linkLocal = async () => {
  const existing = await fs.lstat(LOCAL_LINK).catch(() => null);
  if (existing && !existing.isSymbolicLink()) return;
  if (!LOCAL) {
    if (existing) await fs.unlink(LOCAL_LINK);
    return;
  }
  if (!existing)
    await fs.symlink(path.relative(PUBLIC_DIR, EXAMPLES_ROOT), LOCAL_LINK);
};

/** JSON the file has already, however formatted (oxfmt formats the committed one): not written. */
const write = async (file, value, space) => {
  const same = await fs
    .readFile(file, 'utf8')
    .then((text) => JSON.stringify(JSON.parse(text)) === JSON.stringify(value))
    .catch(() => false);
  if (!same)
    await fs.writeFile(file, `${JSON.stringify(value, null, space)}\n`);
};

const generate = async () => {
  const examples = await listExamples(EXAMPLES_ROOT, '').catch(() => []);
  examples.sort((a, b) => a.path.localeCompare(b.path));
  await fs.mkdir(path.dirname(LIB_FILE), { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await write(LIB_FILE, examples, 2);
  await write(PUBLIC_FILE, examples, 2);
  await write(PREVIEWS_FILE, await previewsOf(examples));
  console.log(
    `${examples.length} example projects → ${path.relative(process.cwd(), LIB_FILE)}`,
  );
};

await linkLocal();
await generate();

if (WATCH) {
  let timer;
  watchFs(EXAMPLES_ROOT, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => generate().catch(console.error), 200);
  });
  console.log(`watching ${path.relative(process.cwd(), EXAMPLES_ROOT)}`);
}

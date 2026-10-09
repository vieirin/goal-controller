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
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// examples/ at the repository root (this script runs from packages/ui)
const EXAMPLES_ROOT = path.resolve(__dirname, '..', '..', '..', 'examples');
const LIB_FILE = path.resolve(__dirname, '..', 'lib', 'examples-manifest.json');
const PUBLIC_FILE = path.resolve(__dirname, '..', 'public', 'examples.json');
// generated conformance models are not hand-written examples
const SKIP_DIRS = new Set(['generated', 'props', 'results']);
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

const examples = await listExamples(EXAMPLES_ROOT, '').catch(() => []);
examples.sort((a, b) => a.path.localeCompare(b.path));
const body = `${JSON.stringify(examples, null, 2)}\n`;
await fs.mkdir(path.dirname(LIB_FILE), { recursive: true });
await fs.mkdir(path.dirname(PUBLIC_FILE), { recursive: true });
await fs.writeFile(LIB_FILE, body);
await fs.writeFile(PUBLIC_FILE, body);
console.log(
  `${examples.length} example projects → ${path.relative(process.cwd(), LIB_FILE)}`,
);

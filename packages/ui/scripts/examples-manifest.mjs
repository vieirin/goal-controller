#!/usr/bin/env node
/**
 * Builds packages/ui/public/examples.json at build/dev time: the static site has no
 * server to list examples/ from, so the list is a manifest baked in ahead of time
 * (services/examples.ts fetches it, and reads the files themselves from GitHub raw URLs).
 * Ports listExamples/isGoalModel from the former app/api/examples/route.ts.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// examples/ at the repository root (this script runs from packages/ui)
const EXAMPLES_ROOT = path.resolve(__dirname, '..', '..', '..', 'examples');
const OUT_FILE = path.resolve(__dirname, '..', 'public', 'examples.json');
// generated conformance models are not hand-written examples
const SKIP_DIRS = new Set(['generated', 'props', 'results']);

/** Only piStar goal models (some .txt files in examples/ are PRISM sketches). */
const isGoalModel = async (file) => {
  try {
    const model = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(model.actors);
  } catch {
    return false;
  }
};

const listExamples = async (dir, group) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await listExamples(full, group || entry.name)));
      }
    } else if (entry.name.endsWith('.txt') && (await isGoalModel(full))) {
      files.push({
        path: path.relative(EXAMPLES_ROOT, full),
        group: group || 'examples',
        name: path.relative(path.join(EXAMPLES_ROOT, group), full),
      });
    }
  }
  return files;
};

const examples = await listExamples(EXAMPLES_ROOT, '').catch(() => []);
examples.sort((a, b) => a.path.localeCompare(b.path));
await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(examples));
console.log(
  `${examples.length} examples written to ${path.relative(process.cwd(), OUT_FILE)}`,
);

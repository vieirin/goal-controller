#!/usr/bin/env node
/**
 * Builds the examples manifest at build/dev time: the static site has no server to
 * list examples/ from, so the list is baked in. Written as an importable JSON module
 * (services/examples.ts imports it) and also to public/ for a static URL if needed.
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
const body = `${JSON.stringify(examples, null, 2)}\n`;
await fs.mkdir(path.dirname(LIB_FILE), { recursive: true });
await fs.mkdir(path.dirname(PUBLIC_FILE), { recursive: true });
await fs.writeFile(LIB_FILE, body);
await fs.writeFile(PUBLIC_FILE, body);
console.log(
  `${examples.length} examples → ${path.relative(process.cwd(), LIB_FILE)}`,
);

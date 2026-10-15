// `langium generate` for every Langium language an engine ships
// (goal-controller#143): each `langium-config.json` under the folders given
// (default src/engines: an engine's `language/`, or any folder of its), its
// parser written to the config's `out` (generated/, committed, as the
// generator writes it). `pnpm run build` runs it first; `pnpm run generate`
// adds the tests' toy languages.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = process.argv.slice(2);

/** Every langium-config.json under a folder, node_modules and generated/ left out. */
const configsUnder = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory())
      return entry.name === 'node_modules' || entry.name === 'generated'
        ? []
        : configsUnder(path);
    return entry.name === 'langium-config.json' ? [path] : [];
  });

const langium = join(lib, 'node_modules', '.bin', 'langium');
for (const root of roots.length ? roots : ['src/engines'])
  for (const config of configsUnder(join(lib, root)).sort()) {
    try {
      execFileSync(langium, ['generate', '--file', config], {
        cwd: lib,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    } catch {
      console.error(`langium generate failed: ${relative(lib, config)}`);
      process.exit(1);
    }
    console.log(`langium generate: ${relative(lib, config)}`);
  }

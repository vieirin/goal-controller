// Each rule file (src/**/*.rls, Nemo's Datalog) as a module of its text,
// `<name>.rules.ts` beside it, so the rules reach Node and the browser alike
// without reading a file at run time (goal-controller#74).
//
//   node scripts/rules.mjs           write them
//   node scripts/rules.mjs --check   fail when one is missing or stale
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const SRC = new URL('../src', import.meta.url).pathname;
const check = process.argv.includes('--check');

const ruleFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? ruleFiles(join(dir, entry.name))
      : entry.name.endsWith('.rls')
        ? [join(dir, entry.name)]
        : [],
  );

const moduleOf = (file) =>
  `// Generated from ${basename(file)} by scripts/rules.mjs: edit the .rls file.\n` +
  `export default ${JSON.stringify(readFileSync(file, 'utf8'))};\n`;

let stale = 0;
for (const file of ruleFiles(SRC)) {
  const target = file.replace(/\.rls$/, '.rules.ts');
  const text = moduleOf(file);
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== text) {
      console.error(`${target} is stale: run node scripts/rules.mjs`);
      stale += 1;
    }
  } else writeFileSync(target, text);
}
if (stale) process.exit(1);

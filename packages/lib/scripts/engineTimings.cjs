// The engines on the rule layer, timed on the real projects (goal-controller#75):
// what the rules worker does per edit, its project read into facts by the
// engine's readers, then evaluated with the engine's prepared rules.
// Medians of 15 runs after a warm-up.
//
//   pnpm --filter @goal-controller/lib run build && node scripts/engineTimings.cjs
const fs = require('fs');
const path = require('path');
const nemo = require('nemo-wasm');
const { goalView } = require('@goal-controller/goal-tree');
const { parsePistar } = require(
  require.resolve('@istar-ts/core', {
    paths: [path.join(__dirname, '..', '..', 'goal-tree')],
  }),
);
const lib = require('../out');

const ROOT = path.join(__dirname, '..', '..', '..');
const ENGINES = {
  mutrose: [lib.mutrose, lib.mutroseRules],
  edgev2: [lib.edgeV2, lib.edgeV2Rules],
  goda: [lib.goda, lib.godaRules],
};
const PROJECTS = [
  ['GODA BSN', 'examples/goda/bsn'],
  ['tas3-edgev2', 'examples/projects/tas3-edgev2'],
  ['GODA Fragmented', 'examples/goda/fragmented'],
  ['medicine-delivery', 'examples/projects/medicine-delivery'],
];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => `${x.toFixed(2)} ms`;

(async () => {
  console.log('| Project | Facts | Read | Evaluate | Per edit |');
  console.log('|---|---|---|---|---|');
  for (const [label, dir] of PROJECTS) {
    const root = path.join(ROOT, dir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'project.json'), 'utf8'),
    );
    const [dialect, rules] = ENGINES[manifest.dialect];
    const project = {
      model: goalView(
        parsePistar(
          fs.readFileSync(path.join(root, manifest.models[0].path), 'utf8'),
        ),
        dialect,
      ),
      resources: Object.entries(manifest.projectResources ?? {}).flatMap(
        ([kind, paths]) =>
          (Array.isArray(paths) ? paths : [paths]).map((p) => ({
            kind,
            path: p,
            text: fs.readFileSync(path.join(root, p), 'utf8'),
          })),
      ),
    };
    await lib.checkProject(nemo, rules, project);
    const read = [];
    const evaluate = [];
    let facts = 0;
    for (let i = 0; i < 15; i += 1) {
      let at = performance.now();
      const project_ = lib.readProject(rules, project);
      read.push(performance.now() - at);
      facts = project_.facts.size;
      at = performance.now();
      await lib.evaluateRules(lib.rulesFor(nemo, rules), project_.facts);
      evaluate.push(performance.now() - at);
    }
    console.log(
      `| ${label} | ${facts} | ${ms(median(read))} | ${ms(median(evaluate))} | ${ms(median(read) + median(evaluate))} |`,
    );
  }
})();

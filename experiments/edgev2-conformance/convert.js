#!/usr/bin/env node
// Batch-convert piStar goal models to edgeV2 PRISM models.
// Usage: node convert.js manifest.json
// manifest: [{ "goal": "path/goal.txt", "out": "path/edgev2.prism", "n": 10 }]
// Every task gets achievability 0.8 (the reference fuzzer's value).
const fs = require('fs');
const path = require('path');

const lib = require(path.resolve(__dirname, '../../packages/lib/out'));

const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let failures = 0;
for (const { goal, out, n } of manifest) {
  const errorFile = out.replace(/\.prism$/, '.error.txt');
  fs.rmSync(errorFile, { force: true });
  try {
    const logger = lib.initEdgeV2Logger(goal, false, true);
    const tree = lib.GoalTree.fromModel(lib.Model.load(goal), lib.edgeV2EngineMapper);
    const variables = Object.fromEntries(
      lib.GoalTree.allByType(tree.nodes, 'task').map((t) => [`${t.id}_achievable`, 0.8]),
    );
    const prism = lib.generateEdgeV2PrismModel({
      gm: tree.nodes,
      fileName: goal,
      variables,
      discretisation: n,
    });
    logger.close?.();
    fs.writeFileSync(out, prism);
  } catch (error) {
    failures += 1;
    fs.rmSync(out, { force: true });
    fs.writeFileSync(errorFile, String(error && error.stack ? error.stack : error));
  }
}
process.stdout.write(`converted ${manifest.length - failures}/${manifest.length}\n`);

#!/usr/bin/env node
/**
 * The CAIRIS seeds (goal-controller#192, #204): each environment of the
 * three CAIRIS exemplars (lib's test fixtures, cairis-platform/cairis
 * `44cc57d`, Apache 2.0) as a KAOS project of its own (D2),
 * `examples/kaos/cairis-<exemplar>-<environment>/`: its model as lib's
 * CAIRIS importer reads the file, and its project manifest (kaosprop's
 * mode). The README and an expected CSV beside them are written by hand.
 *
 *   pnpm run build:lib && node scripts/kaos-stress/cairis-seeds.cjs
 *
 * `stress:kaos` (run.cjs) and lib's tests check that each seed's model is
 * the file read, byte for byte. Requiring this file gives the seeds' list.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(ROOT, 'packages/lib/test/importers/fixtures/cairis');
const SEEDS_DIR = path.join(ROOT, 'examples', 'kaos');

/** The exemplars: their fixture, their model's name, their seeds' prefix. */
const CAIRIS_EXEMPLARS = [
  { file: 'NeuroGrid.xml', modelName: 'NeuroGrid', slug: 'neurogrid' },
  { file: 'ACME_Water.xml', modelName: 'ACME_Water', slug: 'acme-water' },
  { file: 'Balkan_Rail.xml', modelName: 'Balkan_Rail', slug: 'balkan-rail' },
];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Each exemplar's environments' models, read with lib's importer (`out/`), as seeds. */
const cairisSeeds = (lib) =>
  CAIRIS_EXEMPLARS.flatMap((exemplar) => {
    const text = fs.readFileSync(path.join(FIXTURES, exemplar.file), 'utf8');
    const { models } = lib.readCairis(text, { modelName: exemplar.modelName });
    return models.map((m) => {
      const seed = `cairis-${exemplar.slug}-${lib.cairisEnvironmentSlug(m.environment)}`;
      return { seed, exemplar, environment: m.environment, result: m.result };
    });
  });

/** A seed's project manifest: its one model, in kaosprop's mode. */
const manifestOf = (seed, engine) => ({
  version: 1,
  dialect: engine,
  framework: 'kaos',
  models: [{ path: `${seed}.txt` }],
  projectResources: {},
  outputs: [],
});

const main = () => {
  const lib = require(path.join(ROOT, 'packages/lib/out/index.js'));
  for (const { seed, result } of cairisSeeds(lib)) {
    const dir = path.join(SEEDS_DIR, seed);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${seed}.txt`), json(result.model));
    fs.writeFileSync(
      path.join(dir, 'project.json'),
      json(manifestOf(seed, result.dialectRecord.engine)),
    );
    console.log(`${seed}: ${result.model.orphans.length} elements`);
  }
};

module.exports = { CAIRIS_EXEMPLARS, FIXTURES, cairisSeeds, manifestOf, json };

if (require.main === module) main();

#!/usr/bin/env node
/**
 * What the goal language makes of every example, written to a directory, for
 * comparing a language change against the code before it:
 *
 *   pnpm run build:lib && pnpm snapshot:language /tmp/before
 *   (change the language)
 *   pnpm run build:lib && pnpm snapshot:language /tmp/after
 *   diff -r /tmp/before /tmp/after        # nothing, unless the change meant it
 *
 * For each example under examples/edge and examples/edgeV2, in both Edge
 * engines: its Notation view document (`notation/`) and its generated PRISM
 * (`prism/`); for examples/pistar-ext, its document in piStar-ext's dialect.
 * A model an engine rejects is written as `ERROR <message>`. It reads the
 * packages' built output (`out/`), so build them first.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/language-snapshot.cjs <output directory>');
  process.exit(1);
}

const pkg = (name) => path.join(ROOT, 'packages', name);
const lib = require(path.join(pkg('lib'), 'out/index.js'));
const language = require(path.join(pkg('goal-language'), 'out/cjs/index.cjs'));
const dialect = require(path.join(pkg('dialect'), 'out/index.js'));
const goalTree = require(path.join(pkg('goal-tree'), 'out/index.js'));
const core = require(
  require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
);

// the readers report what an engine doesn't enable on the console: not output
console.error = () => {};

const EXAMPLES = path.join(ROOT, 'examples');
const examples = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return examples(file);
    return entry.name.endsWith('.txt') && !entry.name.endsWith('.expected.txt')
      ? [file]
      : [];
  });
const name = (engine, file) =>
  `${engine}__${path.relative(EXAMPLES, file).replace(/\//g, '_')}`;
const attempt = (make) => {
  try {
    return make();
  } catch (error) {
    return `ERROR ${error instanceof Error ? error.message : String(error)}`;
  }
};
const write = (dir, file, text) => {
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  fs.writeFileSync(path.join(out, dir, file), text);
};

const edgeExamples = [
  ...examples(path.join(EXAMPLES, 'edge')),
  ...examples(path.join(EXAMPLES, 'edgeV2')),
];
const ENGINES = {
  edge: {
    definition: lib.edge,
    mapper: lib.edgeEngineMapper,
    prism: (gm) => {
      lib.initLogger('m', false, true);
      return lib.generateValidatedPrismModel({
        gm,
        fileName: 'm',
        clean: true,
        writeReport: false,
      });
    },
  },
  edgeV2: {
    definition: lib.edgeV2,
    mapper: lib.edgeV2EngineMapper,
    prism: (gm) => {
      lib.initEdgeV2Logger('m', false, true);
      return lib.generateEdgeV2PrismModel({ gm, fileName: 'm', clean: true });
    },
  },
};

for (const [engine, { definition, mapper, prism }] of Object.entries(ENGINES))
  for (const file of edgeExamples) {
    const text = fs.readFileSync(file, 'utf8');
    write(
      'notation',
      name(engine, file),
      attempt(
        () =>
          language.notationDocument(
            definition,
            goalTree.goalView(core.parsePistar(text), definition),
          ).text,
      ),
    );
    write(
      'prism',
      name(engine, file),
      attempt(() => {
        const model = goalTree.Model.validate(core.parsePistar(text));
        return prism(goalTree.GoalTree.fromModel(model, mapper).nodes);
      }),
    );
  }

const rationalAgents = lib.istar4RationalAgents;
const metamodel = core.extendMetamodel(
  core.ISTAR_2_0,
  core.defineMetamodelExtension(dialect.metamodelExtensionOf(rationalAgents)),
);
for (const file of examples(path.join(EXAMPLES, 'pistar-ext')))
  write(
    'notation',
    `pistarext__${path.basename(file)}`,
    attempt(
      () =>
        language.notationDocument(
          dialect.dialectDefinition(rationalAgents),
          goalTree.goalView(
            core.parsePistar(fs.readFileSync(file, 'utf8'), { metamodel }),
            lib.edgeV2,
          ),
        ).text,
    ),
  );

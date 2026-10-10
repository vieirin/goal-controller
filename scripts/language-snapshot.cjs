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
 * (`prism/`); SLEEC's output for examples/sleec (`sleec/`), MutRoSe's for
 * examples/mutrose and the medicine-delivery project (`mutrose/`); for
 * examples/pistar-ext, its document in piStar-ext's dialect.
 * An engine's output of several files is written as one file each
 * (`<name>__<file name>`). A model an engine rejects is written as
 * `ERROR <message>`. It reads the packages' built output (`out/`), so build
 * them first.
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
/** An engine's output: one file under the example's name, several as `<name>__<file name>`. */
const writeOutput = (dir, base, make) => {
  const output = attempt(make);
  if (typeof output === 'string') return write(dir, base, output);
  if (output.files.length === 1) return write(dir, base, output.files[0].text);
  for (const file of output.files)
    write(dir, `${base}__${file.fileName}`, file.text);
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
      return lib.edgeOutput({
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
      return lib.edgeV2Output({ gm, fileName: 'm', clean: true });
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
    writeOutput('prism', name(engine, file), () => {
      const model = goalTree.Model.validate(core.parsePistar(text));
      return prism(goalTree.GoalTree.fromModel(model, mapper).nodes);
    });
  }

// the engines without a notation document: their output only
const OUTPUT_ENGINES = {
  sleec: {
    files: examples(path.join(EXAMPLES, 'sleec')),
    mapper: lib.sleecEngineMapper,
    generate: (gm) => lib.sleecOutput(gm, { modelName: 'm' }),
  },
  mutrose: {
    files: [
      ...examples(path.join(EXAMPLES, 'mutrose')),
      ...examples(path.join(EXAMPLES, 'projects', 'medicine-delivery')),
    ],
    mapper: lib.mutroseEngineMapper,
    generate: (gm) => lib.mutroseOutput(gm, { modelName: 'm' }),
  },
};
for (const [engine, { files, mapper, generate }] of Object.entries(
  OUTPUT_ENGINES,
))
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    writeOutput(engine, name(engine, file), () => {
      const model = goalTree.Model.validate(core.parsePistar(text));
      return generate(goalTree.GoalTree.fromModel(model, mapper).nodes);
    });
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

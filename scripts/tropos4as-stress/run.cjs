#!/usr/bin/env node
/**
 * The Tropos4AS stress test (goal-controller#136), one command:
 *
 *   pnpm stress:tropos4as                     # builds lib, then runs this
 *   node scripts/tropos4as-stress/run.cjs [--strict]
 *
 * Every seed is committed (examples/tropos4as/<seed>/, a project): nothing
 * to fetch, no oracle to run. For each seed, through lib's built `out/`:
 *
 * - **import**: the piStar file, read with its metamodel block, as the
 *   lifecycle reads it (`tropos4asAnalysisModel`, `readTropos4asModel`);
 * - **checks**: `tropos4asProblems`, no error (warnings are listed);
 * - **notation**: the model's Notation view document reads back to the same
 *   model (`notationEdits` gives no edit) and has no diagnostic;
 * - **analysis**: the engine's analysis on every scenario, without error;
 * - **trace** per scenario (its project's `scenarios`): the lifecycle's
 *   trace against `reference/trace-<scenario>.txt`, exactly, row for row
 *   (`#` lines aside). A reference whose header says `# compare: the state
 *   changes of <goal>` is compared with that goal's state changes (what
 *   AAMAS 2009's Fig. 3 draws).
 * - **importer**: the seed's TAOM4E twin (`<seed>.tropos` in
 *   packages/lib/test/engines/tropos4as/taom4e/, written by hand, unverified
 *   against TAOM4E) imported with `readTaom4e`, equal to the seed in what
 *   TAOM4E's base metamodel carries (`taom4eCarried`); and the GODA-shaped
 *   twin of examples/goda/dm, its GODA output equal to dm2.txt's, file for
 *   file (#134 D1.3), a row of its own.
 *
 * Writes SUMMARY.md and a JSON per seed to .cache/tropos4as/results/. Exits
 * non-zero only with `--strict`, on a failure.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SEEDS = path.join(ROOT, 'examples', 'tropos4as');
const TWINS = path.join(ROOT, 'packages/lib/test/engines/tropos4as/taom4e');
const GODA_TWIN = {
  fixture: 'dm-goda.tropos',
  seed: 'examples/goda/dm/dm2.txt',
};
const RESULTS = path.join(ROOT, '.cache', 'tropos4as', 'results');
const pkg = (name) => path.join(ROOT, 'packages', name);
const lib = require(path.join(pkg('lib'), 'out/index.js'));
const { nativeCell, nativeCheck } = require('../native-column.cjs');
const language = require(path.join(pkg('goal-language'), 'out/cjs/index.cjs'));
const goalTree = require(path.join(pkg('goal-tree'), 'out/index.js'));
// parsePistar is @istar-ts/core's, as goal-tree resolves it
const core = require(
  require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
);

const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };
const errorText = (error) =>
  error instanceof Error ? error.message : String(error);
const rowsOf = (text) =>
  text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
const PROJECTION = /^# compare: the state changes of (\S+)$/m;

/** A trace against its reference: equal, or the first row that differs. */
const compareTrace = (model, run, referenceText) => {
  const only = PROJECTION.exec(referenceText)?.[1];
  const actual = rowsOf(lib.traceText(model, run, only));
  const expected = rowsOf(referenceText);
  const at = expected.findIndex((row, i) => actual[i] !== row);
  const differs = at >= 0 || actual.length !== expected.length;
  return {
    status: differs ? 'fail' : 'pass',
    rows: expected.length - 1, // the header row aside
    ...(only && { only }),
    ...(differs && {
      first: {
        row: at >= 0 ? at + 1 : expected.length + 1,
        expected: expected[at] ?? '(end)',
        actual: actual[at >= 0 ? at : expected.length] ?? '(end)',
      },
    }),
  };
};

/** A seed's `.tropos` twin, imported: what the base metamodel carries, equal. */
const checkTwin = (seed, seedFile) => {
  const twin = path.join(TWINS, `${seed}.tropos`);
  if (!fs.existsSync(twin))
    return { status: 'skip', reason: `no taom4e/${seed}.tropos` };
  try {
    const { model, diagnostics } = lib.readTaom4e(
      fs.readFileSync(twin, 'utf8'),
      {
        modelName: seed,
      },
    );
    if (!model)
      return {
        status: 'fail',
        error: diagnostics.map((d) => d.message).join('; '),
      };
    const expected = lib.taom4eCarried(
      JSON.parse(fs.readFileSync(seedFile, 'utf8')),
    );
    const difference = lib.carriedDifference(
      expected,
      lib.taom4eCarried(model),
    );
    return difference
      ? { status: 'fail', error: difference }
      : {
          status: 'pass',
          elements: expected.elements.length,
          links: expected.links.length,
          warnings: diagnostics.filter((d) => d.severity !== 'info').length,
        };
  } catch (error) {
    return { status: 'fail', error: errorText(error) };
  }
};

/** The GODA-shaped twin: through the GODA engine, what its piStar twin generates. */
const checkGodaTwin = () => {
  try {
    const { model, dialectRecord, diagnostics } = lib.readTaom4e(
      fs.readFileSync(path.join(TWINS, GODA_TWIN.fixture), 'utf8'),
      { modelName: 'dm2' },
    );
    if (!model || dialectRecord.engine !== 'goda')
      return {
        status: 'fail',
        error: model
          ? `read as ${dialectRecord.engine}'s, not GODA's`
          : diagnostics.map((d) => d.message).join('; '),
      };
    const generate = (text) =>
      lib.godaOutput(lib.godaGoalModel(goalTree.Model.parse(text, lib.goda)), {
        modelName: 'dm2.txt',
        variant: 'cc808b6',
      }).files;
    const ours = generate(JSON.stringify(model));
    const theirs = generate(
      fs.readFileSync(path.join(ROOT, GODA_TWIN.seed), 'utf8'),
    );
    const differs = theirs.find(
      (f, i) => ours[i]?.fileName !== f.fileName || ours[i]?.text !== f.text,
    );
    return differs || ours.length !== theirs.length
      ? {
          status: 'fail',
          error: `${differs?.fileName ?? 'the file list'} differs from ${GODA_TWIN.seed}'s`,
        }
      : { status: 'pass', files: theirs.length };
  } catch (error) {
    return { status: 'fail', error: errorText(error) };
  }
};

const checkSeed = (dir) => {
  const project = JSON.parse(
    fs.readFileSync(path.join(dir, 'project.json'), 'utf8'),
  );
  const file = path.join(dir, project.models[0].path);
  const checks = {};
  let model;
  let analysisModel;
  let pistar;
  try {
    pistar = core.parsePistar(fs.readFileSync(file, 'utf8'), {
      fileMetamodel: true,
    });
    analysisModel = lib.tropos4asAnalysisModel(pistar);
    model = lib.readTropos4asModel(analysisModel);
    checks.import = {
      status: 'pass',
      elements: analysisModel.elements.length,
      links: analysisModel.links.length,
    };
  } catch (error) {
    checks.import = { status: 'fail', error: errorText(error) };
    return { checks, scenarios: [] };
  }
  const problems = lib.tropos4asProblems(model);
  const errors = problems.filter((p) => p.severity === 'error');
  checks.checks = {
    status: errors.length ? 'fail' : 'pass',
    errors: errors.map((p) => p.message),
    warnings: problems
      .filter((p) => p.severity === 'warning')
      .map((p) => p.message),
  };
  try {
    const view = goalTree.goalView(pistar, lib.tropos4as);
    const { text } = language.notationDocument(lib.tropos4as, view);
    const edits = language.notationEdits(lib.tropos4as, text, view);
    const diagnostics = language.documentDiagnostics(
      lib.tropos4as,
      text,
      language.contextFromView(lib.tropos4as, view, []),
    );
    checks.notation =
      edits.length || diagnostics.length
        ? {
            status: 'fail',
            error: edits.length
              ? `reads back with ${edits.length} edit(s): ${JSON.stringify(edits[0])}`
              : `${diagnostics.length} diagnostic(s): ${diagnostics[0].message}`,
          }
        : { status: 'pass', lines: text.split('\n').filter(Boolean).length };
  } catch (error) {
    checks.notation = { status: 'fail', error: errorText(error) };
  }
  const paths = project.projectResources?.scenarios ?? [];
  const files = paths.map((p) => ({
    path: p,
    text: fs.readFileSync(path.join(dir, p), 'utf8'),
  }));
  const analysis = lib.tropos4asAnalyses.tropos4asLifecycle;
  const ran = lib.runAnalysis(
    analysis,
    analysisModel,
    Object.fromEntries(files.map((f) => [f.path, f.text])),
  );
  checks.analysis =
    'error' in ran
      ? { status: 'fail', error: ran.error }
      : { status: 'pass', cases: ran.result.cases.length };
  checks.importer = checkTwin(path.basename(dir), file);
  checks.native = nativeCheck(
    lib,
    lib.tropos4as,
    JSON.parse(fs.readFileSync(file, 'utf8')),
    { modelName: path.basename(dir) },
  );
  const { scenarios, diagnostics } = lib.readTropos4asScenarios(files);
  if (diagnostics.length)
    checks.scenarios = {
      status: 'fail',
      error: diagnostics.map((d) => `${d.path}: ${d.message}`).join('; '),
    };
  return {
    checks,
    scenarios: scenarios.map((scenario) => {
      const name = path.basename(scenario.path, '.json');
      const reference = path.join(dir, 'reference', `trace-${name}.txt`);
      try {
        const run = lib.runLifecycle(model, scenario);
        return {
          scenario: name,
          label: scenario.label,
          trace: fs.existsSync(reference)
            ? compareTrace(model, run, fs.readFileSync(reference, 'utf8'))
            : { status: 'skip', reason: `no reference/trace-${name}.txt` },
        };
      } catch (error) {
        return {
          scenario: name,
          label: scenario.label,
          trace: { status: 'fail', error: errorText(error) },
        };
      }
    }),
  };
};

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const describe = (check) =>
  !check
    ? ''
    : check.status === 'skip'
      ? `${ICON.skip} ${check.reason}`
      : check.error
        ? `${ICON.fail} ${check.error}`
        : ICON[check.status];

const markdown = (results, godaTwin) =>
  [
    '# Tropos4AS stress test (goal-controller#136)',
    '',
    `Generated ${new Date().toISOString()}. Seeds: examples/tropos4as/ (each transcribed from a paper's figure, its README says what is ours).`,
    '',
    '| Seed | Scenario | Imported | Checks | Notation | Analysis | Trace | Importer | Native |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.flatMap(({ seed, checks, scenarios }) => {
      const common = [
        checks.import.status === 'pass'
          ? `${ICON.pass} ${checks.import.elements} elements, ${checks.import.links} links`
          : describe(checks.import),
        checks.checks
          ? checks.checks.status === 'pass'
            ? `${ICON.pass}${checks.checks.warnings.length ? ` (${checks.checks.warnings.length} warning(s): ${checks.checks.warnings[0]})` : ''}`
            : `${ICON.fail} ${checks.checks.errors[0]}`
          : '',
        checks.notation?.status === 'pass'
          ? `${ICON.pass} ${checks.notation.lines} lines, read back unchanged`
          : describe(checks.notation),
        checks.analysis
          ? checks.analysis.status === 'pass'
            ? `${ICON.pass} ${checks.analysis.cases} case(s)`
            : describe(checks.analysis)
          : '',
      ];
      const importer =
        checks.importer?.status === 'pass'
          ? `${ICON.pass} unverified twin: ${checks.importer.elements} elements, ${checks.importer.links} links carried${checks.importer.warnings ? `, ${checks.importer.warnings} warning(s)` : ''}`
          : describe(checks.importer);
      const native = nativeCell(checks.native);
      return (
        scenarios.length ? scenarios : [{ scenario: '', trace: null }]
      ).map(
        ({ scenario, trace }) =>
          `| ${[
            seed,
            scenario,
            ...common,
            !trace
              ? ''
              : trace.status === 'pass'
                ? `${ICON.pass} exact, ${trace.rows} rows${trace.only ? ` (${trace.only}'s state changes)` : ''}`
                : trace.first
                  ? `${ICON.fail} row ${trace.first.row}: expected \`${trace.first.expected}\`, got \`${trace.first.actual}\``
                  : describe(trace),
            importer,
            native,
          ]
            .map(cell)
            .join(' | ')} |`,
      );
    }),
    ...(godaTwin
      ? [
          `| taom4e/${GODA_TWIN.fixture} (GODA-shaped) | | | | | | | ${cell(
            godaTwin.status === 'pass'
              ? `${ICON.pass} GODA engine: ${godaTwin.files} files equal ${GODA_TWIN.seed}'s`
              : describe(godaTwin),
          )} |`,
        ]
      : []),
    '',
  ].join('\n');

const failed = ({ checks, scenarios }) =>
  Object.values(checks).some((check) => check.status === 'fail') ||
  scenarios.some(({ trace }) => trace.status === 'fail');

const main = () => {
  const strict = process.argv.includes('--strict');
  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const results = fs
    .readdirSync(SEEDS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((seed) => ({ seed, ...checkSeed(path.join(SEEDS, seed)) }));
  for (const result of results) {
    fs.writeFileSync(
      path.join(RESULTS, `${result.seed}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log(
      `${result.seed.padEnd(24)} ${Object.entries(result.checks)
        .map(([name, check]) => `${name}:${check.status}`)
        .join(' ')} ${result.scenarios
        .map(({ scenario, trace }) => `${scenario}:${trace.status}`)
        .join(' ')}`,
    );
  }
  const godaTwin = checkGodaTwin();
  fs.writeFileSync(
    path.join(RESULTS, 'goda-twin.json'),
    `${JSON.stringify(godaTwin, null, 2)}\n`,
  );
  console.log(`${'taom4e/dm-goda'.padEnd(24)} importer:${godaTwin.status}`);
  fs.writeFileSync(
    path.join(RESULTS, 'SUMMARY.md'),
    markdown(results, godaTwin),
  );
  console.log(
    `results in ${path.relative(ROOT, RESULTS)} (SUMMARY.md, one JSON per seed)`,
  );
  const failures = [
    ...results.filter(failed),
    ...(godaTwin.status === 'fail' ? [{ seed: 'taom4e/dm-goda' }] : []),
  ];
  if (failures.length)
    console.log(`failing: ${failures.map((r) => r.seed).join(', ')}`);
  return strict && failures.length ? 1 : 0;
};

process.exit(main());

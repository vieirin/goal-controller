#!/usr/bin/env node
/**
 * The STS-ml stress test (goal-controller#163, plan and decisions in #160),
 * one command:
 *
 *   pnpm stress:sts                                  # builds lib, then runs this
 *   node scripts/sts-stress/run.cjs [--strict] [--update] [--oracle]
 *
 * Through lib's built `out/`:
 *
 * 1. **The seeds** (examples/sts/<seed>/, drawn from the papers' figures):
 *    - **import**: the piStar file, read with its metamodel block, as the
 *      checks and analyses read it (`stsAnalysisModel`);
 *    - **checks**: the dialect's problems (`stsProblems`) are none;
 *    - **notation**: the Notation view document reads back to the same
 *      model (no edit) and has no diagnostic;
 *    - **native**: written as STS-Tool's `.sts` and read back, the model is
 *      itself but for the format's lossy paths (#160 D-R9); ATM's
 *      contribution is the one known loss (its README);
 *    - **snapshot**: the `.sts` written is `snapshots/<seed>.sts` (`--update`
 *      rewrites them);
 *    - **analyses**: every analysis of the engine runs without an error; a
 *      seed with `expected-analyses.json` (#161's) gets `runStsAnalyses`'
 *      result compared with it, when lib has it.
 * 2. **The tutorial projects** UniTN publishes (#160 D-R8: fetched, not
 *    committed): each `.exp` downloaded into `.cache/sts/samples/`, its
 *    sha256 checked (the pins: `tutorials.json`), unpacked by lib's `readStsProject` (gzip, then the
 *    Java-serialised file list, read without deserialising any class), its
 *    `.sts` imported. The same
 *    checks but notation and snapshot (a known import warning, Healthcare's
 *    goal in no actor, is expected), and the analyses against
 *    `examples/sts/tutorials/<name>.expected-analyses.json` (#161's), when
 *    it is there. A download that fails skips the tutorial, with a
 *    message; `--strict` then fails.
 * 3. **`--oracle`**: STS-Tool or its DLV, in Docker. Not wired while #160
 *    D-R2 (STS-Tool's EULA) is the owner's open question: reported as
 *    skipped.
 *
 * Writes SUMMARY.md and results.json to .cache/sts/results/. Exits non-zero
 * only with `--strict`, on a failure (or a skipped section).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const SEEDS_DIR = path.join(ROOT, 'examples', 'sts');
const SNAPSHOTS = path.join(__dirname, 'snapshots');
const CACHE = path.join(ROOT, '.cache', 'sts');
const SAMPLES = path.join(CACHE, 'samples');
const RESULTS = path.join(CACHE, 'results');
const pkg = (name) => path.join(ROOT, 'packages', name);
const lib = require(path.join(pkg('lib'), 'out/index.js'));
const language = require(path.join(pkg('goal-language'), 'out/cjs/index.cjs'));
const goalTree = require(path.join(pkg('goal-tree'), 'out/index.js'));
const core = require(
  require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
);

const strict = process.argv.includes('--strict');
const update = process.argv.includes('--update');
const oracle = process.argv.includes('--oracle');
const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * The tutorial projects (sts-tool.eu/tutorials), pinned by sha256: what
 * #160's format notes were read from. Their reports' printed results are
 * #161's. CI caches `.cache/sts/samples` keyed on this file.
 */
const TUTORIALS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tutorials.json'), 'utf8'),
);

/** A check's result: pass when `run` returns without throwing, its value the detail. */
const check = (run) => {
  try {
    const detail = run();
    return { status: 'pass', ...(detail !== undefined && { detail }) };
  } catch (error) {
    return { status: 'fail', error: errorText(error) };
  }
};
const skip = (why) => ({ status: 'skip', detail: why });

/** The analyses' results as compared: each finding its kind, severity and elements, sorted. */
const comparable = (value) =>
  JSON.stringify(value, (key, v) =>
    Array.isArray(v) && v.every((x) => typeof x === 'object' && x)
      ? [...v].map((x) => JSON.stringify(x)).sort()
      : v,
  );

/** The analyses: every one runs; with an expectation and #161's runner, the result is it. */
const analysesCheck = (model, expectedPath) =>
  check(() => {
    const ran = Object.entries(lib.stsAnalyses).map(([id, analysis]) => {
      const run = lib.runAnalysis(analysis, model);
      if ('error' in run) throw new Error(`${id}: ${run.error}`);
      const findings = run.result.cases.reduce(
        (n, c) => n + (c.findings?.length ?? 0),
        0,
      );
      return `${id} ${findings}`;
    });
    let compared = 'no expectation';
    if (expectedPath && fs.existsSync(expectedPath)) {
      if (typeof lib.runStsAnalyses !== 'function')
        throw new Error(
          `${path.relative(ROOT, expectedPath)} exists, but lib has no runStsAnalyses (#161)`,
        );
      const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
      const actual = lib.runStsAnalyses(model);
      if (comparable(actual) !== comparable(expected))
        throw new Error(
          `runStsAnalyses differs from ${path.relative(ROOT, expectedPath)}`,
        );
      compared = `equal to ${path.relative(ROOT, expectedPath)}`;
    }
    return `findings: ${ran.join(', ')}; ${compared}`;
  });

const problemsCheck = (model) =>
  check(() => {
    const problems = lib.stsProblems(model);
    if (problems.length)
      throw new Error(
        problems.map((p) => `${p.kind}: ${p.message}`).join('; '),
      );
    return 'none';
  });

/** A model through `.sts` and back: itself but for the lossy paths, or what differs. */
const nativeCheck = (json, modelName, knownLoss) =>
  check(() => {
    const trip = lib.modelRoundTrip(lib.stsNativeFile, json, { modelName });
    if (trip.problem && !(knownLoss && trip.problem.includes(knownLoss)))
      throw new Error(trip.problem);
    return trip.problem ? `known loss: ${knownLoss}` : 'itself';
  });

/**
 * The tutorials' known import warnings: what the published file holds that
 * an STS-ml model can't (Healthcare draws a goal in no actor).
 */
const KNOWN_WARNINGS = {
  healthcare: ['G17: blood examinedd: in no actor; kept outside them'],
};

/** The seeds' known `.sts` losses (their READMEs say why). */
const KNOWN_LOSS = { atm: 'help-pilot-met-accessed-pilot-fly-safe' };

const seedRows = () =>
  fs
    .readdirSync(SEEDS_DIR)
    .filter((name) => fs.existsSync(path.join(SEEDS_DIR, name, 'project.json')))
    .sort()
    .map((seed) => {
      const dir = path.join(SEEDS_DIR, seed);
      const json = JSON.parse(
        fs.readFileSync(path.join(dir, `${seed}.txt`), 'utf8'),
      );
      const istar = core.parsePistar(json, { fileMetamodel: true });
      const model = lib.stsAnalysisModel(istar);
      const view = goalTree.goalView(istar, lib.sts);
      const { text } = language.notationDocument(lib.sts, view);
      const context = language.contextFromView(lib.sts, view, []);
      const runCheck = (name, properties, self) =>
        lib.stsCheckRegistry[name]?.(
          properties,
          language.checkContextOf(context, self),
        ) ?? null;
      const checks = {
        import: check(
          () =>
            `${model.actors.length} actors, ${model.elements.length} elements, ${model.links.length} links`,
        ),
        checks: problemsCheck(model),
        notation: check(() => {
          const edits = language.notationEdits(lib.sts, text, view);
          if (edits.length) throw new Error(`edits: ${JSON.stringify(edits)}`);
          const diagnostics = language.documentDiagnostics(
            lib.sts,
            text,
            context,
            { runCheck },
          );
          if (diagnostics.length)
            throw new Error(diagnostics.map((d) => d.message).join('; '));
          return `${text.split('\n').length} lines`;
        }),
        native: nativeCheck(json, seed, KNOWN_LOSS[seed]),
        snapshot: check(() => {
          const written = lib.writeSts(json).text;
          const file = path.join(SNAPSHOTS, `${seed}.sts`);
          if (update || !fs.existsSync(file)) {
            fs.mkdirSync(SNAPSHOTS, { recursive: true });
            fs.writeFileSync(file, written);
            return `written: ${path.relative(ROOT, file)}`;
          }
          if (fs.readFileSync(file, 'utf8') !== written)
            throw new Error(
              `differs from ${path.relative(ROOT, file)} (--update rewrites it)`,
            );
          return 'unchanged';
        }),
        analyses: analysesCheck(
          model,
          path.join(dir, 'expected-analyses.json'),
        ),
      };
      return { name: seed, checks };
    });

/** A tutorial's `.exp`, from the cache or downloaded, its sha256 checked. */
const fetchTutorial = async (name, { url, sha256 }) => {
  const file = path.join(SAMPLES, `${name}.exp`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(SAMPLES, { recursive: true });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== sha256) {
    fs.rmSync(file);
    throw new Error(`${name}.exp: sha256 ${digest}, pinned ${sha256}`);
  }
  return bytes;
};

const tutorialRows = async () => {
  const rows = [];
  for (const [name, pin] of Object.entries(TUTORIALS)) {
    let bytes;
    try {
      bytes = await fetchTutorial(name, pin);
    } catch (error) {
      rows.push({
        name,
        checks: { fetch: skip(`not fetched: ${errorText(error)}`) },
      });
      continue;
    }
    const project = await lib.readStsProject(new Uint8Array(bytes));
    const files = 'error' in project ? {} : project.files;
    const stsName = Object.keys(files).find((f) => f.endsWith('.sts'));
    const read =
      !('error' in project) &&
      project.sts !== null &&
      lib.readSts(project.sts, { modelName: name });
    const json = read?.model;
    const model =
      json &&
      lib.stsAnalysisModel(core.parsePistar(json, { fileMetamodel: true }));
    rows.push({
      name,
      checks: {
        fetch: check(() => {
          if ('error' in project) throw new Error(project.error);
          return `${stsName} (${Object.keys(files).length} files)`;
        }),
        import: check(() => {
          if (!json)
            throw new Error(
              stsName
                ? (read.diagnostics ?? []).map((d) => d.message).join('; ')
                : 'no .sts in the project',
            );
          const known = KNOWN_WARNINGS[name] ?? [];
          const warnings = read.diagnostics
            .filter((d) => d.severity !== 'info')
            .map((d) => d.message);
          const unexpected = warnings.filter((m) => !known.includes(m));
          if (unexpected.length) throw new Error(unexpected.join('; '));
          const missing = known.filter((m) => !warnings.includes(m));
          if (missing.length)
            throw new Error(`no longer warns: ${missing.join('; ')}`);
          return `${model.actors.length} actors, ${model.elements.length} elements, ${model.links.length} links${known.length ? `; known: ${known.join('; ')}` : ''}`;
        }),
        checks: json ? problemsCheck(model) : skip('no model'),
        native: json ? nativeCheck(json, name) : skip('no model'),
        analyses: json
          ? analysesCheck(
              model,
              path.join(
                SEEDS_DIR,
                'tutorials',
                `${name}.expected-analyses.json`,
              ),
            )
          : skip('no model'),
      },
    });
  }
  return rows;
};

const oracleRows = () => [
  {
    name: 'STS-Tool',
    checks: {
      oracle: oracle
        ? skip(
            'not wired: whether STS-Tool may be run or read is the owner’s question (#160 D-R2)',
          )
        : skip('run with --oracle'),
    },
  },
];

const main = async () => {
  const sections = {
    seeds: seedRows(),
    tutorials: await tutorialRows(),
    oracle: oracleRows(),
  };
  const lines = ['# STS-ml stress test (goal-controller#163)', ''];
  let failed = 0;
  let skipped = 0;
  for (const [section, rows] of Object.entries(sections)) {
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r.checks)))];
    lines.push(`## ${section}`, '');
    lines.push(`| | ${columns.join(' | ')} |`);
    lines.push(`|---|${columns.map(() => '---').join('|')}|`);
    for (const { name, checks } of rows) {
      lines.push(
        `| ${name} | ${columns
          .map((c) => {
            const r = checks[c];
            if (!r) return '';
            if (r.status === 'fail') failed++;
            if (r.status === 'skip' && section !== 'oracle') skipped++;
            return `${ICON[r.status]} ${cell(r.error ?? r.detail ?? '')}`;
          })
          .join(' | ')} |`,
      );
    }
    lines.push('');
  }
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, 'SUMMARY.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(RESULTS, 'results.json'),
    JSON.stringify(sections, null, 2),
  );
  console.log(lines.join('\n'));
  console.log(
    `\n${failed} failed, ${skipped} skipped; results in ${path.relative(ROOT, RESULTS)}`,
  );
  if (strict && (failed || skipped)) process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

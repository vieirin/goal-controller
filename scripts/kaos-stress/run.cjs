#!/usr/bin/env node
/**
 * The KAOS stress test (goal-controller#190; the KAOS rounds of #189), one
 * command:
 *
 *   pnpm stress:kaos                       # builds lib, then runs this
 *   node scripts/kaos-stress/run.cjs [--strict]
 *
 * Every seed is committed (examples/kaos/<seed>/, a project with its `.kaos`
 * as the native file): nothing to fetch. For each seed, through lib's built
 * `out/`:
 *
 * - **import**: the `.kaos` reads, its model is the committed `<seed>.txt`
 *   byte for byte, its resources (kaosexpert's experts and calibrations)
 *   the committed files, and the mode it opens in the project's;
 * - **validate**: istar-ts validates the model (`validateModel`: none);
 * - **roundtrip**: written back (`writeKaos`, with its resources) and read
 *   again, the same model and the same resources;
 * - **analyses**: kaosprop's analyses, kaosres's and kaosexpert's (all
 *   read every `.kaos`), run without error;
 * - **oracle**: the seed's `*.expected.csv`, each row against what the
 *   engine computes (below).
 *
 * The expected CSVs:
 *
 * - `id,element,probability,paper,derivation` (kaosprop's, PR G's form):
 *   each element's probability within 5e-7, and the paper's printed value
 *   within one unit of its last digit. `las.expected.csv` is the oracle of
 *   RE'12's hand-drawn model (lib's test fixture), not of `las.kaos`; its
 *   rows are also checked under kaosexpert with point estimates (each
 *   sample is kaosprop's EPS, to 1e-9).
 * - `quantity,id,goal,given,expected,tolerance,paper,data,derivation`
 *   (kaosexpert's): each row a quantity, within its tolerance:
 *   - of an expert: `calibration`, `information`, `weight`;
 *   - of an element's distribution: `mean`, `VU`, `US`, `SU@<p>`,
 *     `q<pct>`; with `given` `experts=e1`, of a run on those experts'
 *     estimates only (RE'15's one-expert run);
 *   - of a leaf obstacle alone against `goal` (§VII): `VU alone`, `US
 *     alone`;
 *   - `probability given`: an element's probability with the point
 *     estimates `given` (`id=0.009;…`) in place of the elements' own;
 *   - `formula`: the arithmetic in `given` (a paper's printed step);
 *   - `triangular a`/`triangular b`: the min/max of a triangular
 *     distribution's elicited (a0, m, b0) extended by a tail fraction
 *     (`given = "a0,m,b0,tail"`, `lib.extendTriangular`, HASE'11 §III-B2,
 *     goal-controller#199).
 *
 *   `paper` is the printed value, `data` where the inputs come from; a
 *   mismatch with the paper is the derivation's to explain, the row checks
 *   what the seed gives.
 * - `quantity,selection,goal,expected,tolerance,options,derivation`
 *   (kaosres's countermeasure selection, goal-controller#191): a selection
 *   (its countermeasure goals joined by `+`, `none` for the empty one), run
 *   with `options` (`semantics=kaostools;scope=model;limit=n`):
 *   - `ESR` of `goal` within `tolerance`, `cost`, and `flags` (`safe` or
 *     `not safe`, `consistent` or `inconsistent`, `cost-optimal`);
 *   - of the run (`selection` `-`): `minimal cost` (`none`: no safe
 *     selection), `chosen` (the chosen selections, ` | `), `candidates`,
 *     `evaluated`, `exact` (`yes`/`no`).
 *
 * The corpus (goal-controller#191, #201): ADS's simple.kaos and
 * validation-model.kaos, and las.kaos with obstacles.kaos and
 * resolutions.kaos (goal-language's test fixtures, MIT), selected as
 * `scripts/kaos-stress/ads.expected.csv` says (its `model` column; the
 * option `estimates=ambulance` puts each leaf obstacle at its experts'
 * combined mean, kaosexpert's over the ambulance seed's five experts).
 *
 * Writes SUMMARY.md and a JSON per seed to .cache/kaos/results/. Exits
 * non-zero only with `--strict`, on a failure.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SEEDS_DIR = path.join(ROOT, 'examples', 'kaos');
const RESULTS = path.join(ROOT, '.cache', 'kaos', 'results');
const LAS_FIXTURE = path.join(
  ROOT,
  'packages/lib/test/engines/kaosprop/fixtures/re12-las.txt',
);
const ADS_FIXTURES = path.join(
  ROOT,
  'packages/goal-language/test/fixtures/kaos/ads',
);
const ADS_ORACLE = path.join(__dirname, 'ads.expected.csv');
const pkg = (name) => path.join(ROOT, 'packages', name);
const lib = require(path.join(pkg('lib'), 'out/index.js'));
const dialect = require(
  require.resolve('@goal-controller/dialect', { paths: [pkg('lib')] }),
);
const core = require(
  require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
);
const { KAOS_OBSTACLES } = require(
  require.resolve('@istar-ts/dsm3-kaos/metamodel', { paths: [pkg('lib')] }),
);

const strict = process.argv.includes('--strict');
const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
const errorText = (error) =>
  error instanceof Error ? error.message : String(error);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
/** kaosexpert's runs here: enough samples for the oracles' tolerances, a fixed seed */
const RUN = { samples: 100000, seed: 1 };

const SEEDS = fs
  .readdirSync(SEEDS_DIR)
  .filter((name) => fs.existsSync(path.join(SEEDS_DIR, name, 'project.json')))
  .sort();

/** A CSV's rows as objects by its header, `#` lines (its notes) left out. */
const readCsv = (text) => {
  const lines = text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'));
  const parse = (line) => {
    const fields = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') {
        fields.push(field);
        field = '';
      } else field += c;
    }
    fields.push(field);
    return fields;
  };
  const [header, ...rows] = lines.map(parse);
  return rows.map((row) =>
    Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])),
  );
};

/** A printed value as a number (`6%` is 0.06) and one unit of its last digit. */
const printed = (text) => {
  const read = /^\s*([0-9]*\.?([0-9]*))\s*(%?)\s*$/.exec(text);
  if (!read || !read[1]) return null;
  const scale = read[3] ? 0.01 : 1;
  return {
    value: Number(read[1]) * scale,
    unit: 10 ** -read[2].length * scale,
  };
};

const analysisModelOf = (modelText) =>
  lib.kaospropAnalysisModel(lib.readKaosObstacleModel(modelText));
const expertModelOf = (modelText) =>
  lib.kaosexpertAnalysisModel(lib.readKaosObstacleModel(modelText));

/** kaosprop's rows: each element's probability, the paper's printed value. */
const kaospropOracle = (modelText, rows) => {
  const { probabilities } = lib.propagateProbabilities(
    analysisModelOf(modelText),
  );
  const expert = lib.expertAnalysis(expertModelOf(modelText), {
    options: { samples: 1, seed: 1 },
  });
  const sampled = lib.simulate(
    expert,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const got = probabilities.get(row.id);
    const expected = Number(row.probability);
    const paper = printed(row.paper);
    const problems = [];
    if (got === undefined) problems.push('not computed');
    else {
      if (Math.abs(got - expected) > 5e-7)
        problems.push(`kaosprop ${got.toFixed(6)}, not ${row.probability}`);
      // an erratum the CSV documents (`the paper prints 0.984`) is the paper's, not ours
      if (
        paper &&
        Math.abs(got - paper.value) > paper.unit + 1e-12 &&
        !row.derivation.includes('the paper prints')
      )
        problems.push(`the paper prints ${row.paper}`);
    }
    return {
      quantity: 'probability',
      id: row.id,
      expected: row.probability,
      got: got === undefined ? null : Number(got.toFixed(6)),
      kaosexpert: Number(sampled.get(row.id)?.[0]?.toFixed(9)),
      paper: row.paper,
      status: problems.length ? 'fail' : 'pass',
      ...(problems.length && { problems }),
    };
  });
};

/** kaosexpert's rows: each a quantity of an expert or an element. */
const expertOracle = (modelText, resources, rows) => {
  const model = expertModelOf(modelText);
  const context = { resources, options: RUN };
  const analysis = lib.expertAnalysis(model, context);
  const ids = model.elements.map((e) => e.id);
  const runs = lib.simulate(analysis, ids);
  const rsrOf = (id) => {
    const rsr = model.elements.find((e) => e.id === id)?.properties.RSR;
    return rsr === undefined ? null : dialect.probabilityOf(rsr);
  };
  const alone = new Map();
  const aloneRun = (obstacle) => {
    if (!alone.has(obstacle))
      alone.set(obstacle, lib.simulate(analysis, ids, { only: obstacle }));
    return alone.get(obstacle);
  };
  /** a run on some experts' estimates only (`given`: `experts=e1,e2`), RE'15's one-expert run */
  const subsets = new Map();
  const runsOf = (given) => {
    const subset = /^experts=(.+)$/.exec(given ?? '');
    if (!subset) return runs;
    if (!subsets.has(given)) {
      const keep = new Set(subset[1].split(',').map((e) => e.trim()));
      const kept = (key) => {
        const expert = /^Probability\[(.+)\]$/.exec(key)?.[1];
        return expert === undefined || keep.has(expert);
      };
      const only = {
        ...model,
        elements: model.elements.map((e) => ({
          ...e,
          properties: Object.fromEntries(
            Object.entries(e.properties).filter(([key]) => kept(key)),
          ),
        })),
      };
      const calibrations = Object.fromEntries(
        Object.entries(resources.calibration ?? {}).map(([p, text]) => {
          const file = JSON.parse(text);
          for (const c of file.calibrations)
            c.estimates = Object.fromEntries(
              Object.entries(c.estimates ?? {}).filter(([e]) => keep.has(e)),
            );
          return [p, JSON.stringify(file)];
        }),
      );
      const one = lib.expertAnalysis(only, {
        resources: { ...resources, calibration: calibrations },
        options: RUN,
      });
      subsets.set(given, lib.simulate(one, ids));
    }
    return subsets.get(given);
  };
  const score = (expert) =>
    analysis.weights?.scores.find((s) => s.expert === expert);
  /** an element's probability with point estimates in place of some elements' own */
  const givenProbability = (id, given) => {
    const values = Object.fromEntries(
      given.split(';').map((pair) => pair.split('=').map((t) => t.trim())),
    );
    const pointed = {
      ...model,
      elements: model.elements.map((e) =>
        values[e.id] === undefined
          ? e
          : {
              ...e,
              properties: Object.fromEntries([
                ...Object.entries(e.properties).filter(
                  ([key]) => !key.startsWith('Probability'),
                ),
                ['Probability', values[e.id]],
              ]),
            },
      ),
    };
    const one = lib.expertAnalysis(pointed, {
      resources,
      options: { samples: 1, seed: 1 },
    });
    return lib.simulate(one, [id]).get(id)[0];
  };
  const value = (row) => {
    const { quantity, id, goal: source, given } = row;
    switch (quantity) {
      case 'formula':
        if (!/^[0-9.+\-*/() ]+$/.test(given))
          throw new Error(`not arithmetic: ${given}`);
        return Function(`return (${given});`)();
      case 'probability given':
        return givenProbability(id, given);
      case 'triangular a':
      case 'triangular b': {
        // HASE'11 §III-B2, Figure 3 (goal-controller#199): the elicited
        // (a0, m, b0), extended by `tail` (given = "a0,m,b0,tail")
        const [a0, m, b0, tail] = given.split(',').map(Number);
        const extended = lib.extendTriangular(a0, m, b0, tail);
        return quantity === 'triangular a' ? extended.min : extended.max;
      }
      case 'information':
      case 'calibration':
      case 'weight':
        return score(id)?.[quantity];
      case 'probability':
        return runs.get(id)?.[0];
      case 'mean':
        return lib.distributionOfSamples(runsOf(given).get(id)).mean;
      case 'VU':
        return lib.satisfactionUncertainty(runsOf(given).get(id), rsrOf(id));
      case 'US':
        return lib.uncertaintySpread(runsOf(given).get(id), rsrOf(id));
      case 'VU alone':
        return lib.satisfactionUncertainty(
          aloneRun(id).get(source),
          rsrOf(source),
        );
      case 'US alone':
        return lib.uncertaintySpread(aloneRun(id).get(source), rsrOf(source));
      default: {
        const su = /^SU@([0-9.]+)$/.exec(quantity);
        if (su)
          return lib.satisfactionUncertainty(
            runsOf(given).get(id),
            Number(su[1]),
          );
        const q = /^q([0-9.]+)$/.exec(quantity);
        if (q) {
          const sorted = Float64Array.from(runsOf(given).get(id)).sort();
          const p = Number(q[1]) / 100;
          return sorted[
            Math.min(
              sorted.length - 1,
              Math.max(0, Math.ceil(p * sorted.length) - 1),
            )
          ];
        }
        throw new Error(`unknown quantity ${quantity}`);
      }
    }
  };
  return rows.map((row) => {
    // a number the paper prints and the seed can't reproduce (goal-controller#199):
    // reported, never a failure (README.md)
    if (row.expected.trim() === '-')
      return {
        quantity: row.quantity,
        id: row.id,
        expected: row.expected,
        got: null,
        tolerance: row.tolerance,
        paper: row.paper,
        data: row.data,
        status: 'skip',
      };
    let got;
    try {
      got = value(row);
    } catch (error) {
      return { ...row, status: 'fail', problems: [errorText(error)] };
    }
    const expected = Number(row.expected);
    const tolerance = Number(row.tolerance || 0);
    const ok =
      got !== undefined && Math.abs(got - expected) <= tolerance + 1e-12;
    return {
      quantity: row.quantity,
      id: row.id,
      expected: row.expected,
      got: got === undefined ? null : Number(Number(got).toFixed(6)),
      tolerance: row.tolerance,
      paper: row.paper,
      data: row.data,
      status: ok ? 'pass' : 'fail',
      ...(!ok && {
        problems: [`${got} is not ${row.expected} ± ${tolerance}`],
      }),
    };
  });
};

/** A selection's key: its countermeasure goals joined by `+`, `none` for the empty one. */
const selectionKey = (selection) => selection.goals.join('+') || 'none';
const flagsOf = (s) =>
  [
    s.safe ? 'safe' : 'not safe',
    s.consistent ? 'consistent' : 'inconsistent',
    ...(s.costOptimal ? ['cost-optimal'] : []),
  ].join(', ');
/** `semantics=kaostools;scope=model;limit=8`: the selection's options (the others are the caller's). */
const optionsOf = (text) => {
  const options = {};
  for (const pair of (text ?? '').split(';').filter((p) => p.trim())) {
    const [key, value] = pair.split('=').map((t) => t.trim());
    options[key] = key === 'limit' ? Number(value) : value;
  }
  return options;
};

/** kaosres's rows: each a quantity of a selection, or of the run, on `model` (a KaosModel). */
const selectionOracle = (modelOf, rows) => {
  const runs = new Map();
  const runOf = (options) => {
    if (!runs.has(options)) {
      const { estimates, ...given } = optionsOf(options);
      runs.set(options, lib.selectCountermeasures(modelOf(estimates), given));
    }
    return runs.get(options);
  };
  return rows.map((row) => {
    const result = runOf(row.options);
    const selection = result.selections.find(
      (s) => selectionKey(s) === row.selection,
    );
    let got;
    let ok;
    switch (row.quantity) {
      case 'ESR':
        got = selection?.esr.get(row.goal);
        ok =
          got !== undefined &&
          Math.abs(got - Number(row.expected)) <=
            Number(row.tolerance || 0) + 1e-12;
        break;
      case 'cost':
        got = selection?.cost;
        ok = got !== undefined && Math.abs(got - Number(row.expected)) < 1e-9;
        break;
      case 'flags':
        got = selection && flagsOf(selection);
        ok = got === row.expected;
        break;
      case 'minimal cost':
        got = result.minimalCost ?? 'none';
        ok = String(got) === row.expected;
        break;
      case 'chosen':
        got = result.chosen.map(selectionKey).join(' | ');
        ok = got === row.expected;
        break;
      case 'candidates':
      case 'evaluated':
        got =
          row.quantity === 'candidates'
            ? result.candidates
            : result.selections.length;
        ok = String(got) === row.expected;
        break;
      case 'exact':
        got = result.exact ? 'yes' : 'no';
        ok = got === row.expected;
        break;
      default:
        got = undefined;
        ok = false;
    }
    return {
      quantity: `${row.quantity}${row.goal ? ` ${row.goal}` : ''}`,
      id: row.selection,
      expected: row.expected,
      got: typeof got === 'number' ? Number(got.toFixed(9)) : (got ?? null),
      tolerance: row.tolerance,
      data: row.options,
      status: ok ? 'pass' : 'fail',
      ...(!ok && {
        problems: [
          selection === undefined && row.selection !== '-'
            ? `no selection ${row.selection} evaluated`
            : `${got} is not ${row.expected}`,
        ],
      }),
    };
  });
};

const kaosModelOf = (json) =>
  core.parsePistar(json, { metamodel: KAOS_OBSTACLES });

/**
 * Each leaf obstacle's experts' combined mean, kaosexpert's over the
 * ambulance seed's five experts (RE'15's weighting): ADS's own point
 * estimates are per expert, which kaosprop doesn't read.
 */
const ambulanceMeans = () => {
  const dir = path.join(SEEDS_DIR, 'ambulance');
  const text = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const analysis = lib.expertAnalysis(
    lib.kaosexpertAnalysisModel(
      lib.readKaosObstacleModel(text('ambulance.txt')),
    ),
    {
      resources: {
        expert: { 'experts.json': text('experts.json') },
        calibration: { 'calibrations.json': text('calibrations.json') },
      },
      options: { samples: 1, seed: 1 },
    },
  );
  return new Map(
    [...analysis.leaves].map(([id, event]) => {
      const value = analysis.events[event].value;
      return [id, typeof value === 'number' ? value : value.mean];
    }),
  );
};

/** The corpus's selections (ADS's files, goal-controller#201 and the field run). */
const checkCorpus = () => {
  const rows = readCsv(fs.readFileSync(ADS_ORACLE, 'utf8'));
  const fixture = (f) => fs.readFileSync(path.join(ADS_FIXTURES, f), 'utf8');
  const out = [];
  let means = null;
  for (const model of new Set(rows.map((r) => r.model))) {
    const [main, ...imports] = model.split('+');
    const read = lib.readKaos(fixture(main), {
      modelName: path.basename(main, '.kaos'),
      files: Object.fromEntries(imports.map((f) => [f, fixture(f)])),
    });
    const modelOf = (estimates) => {
      const json = JSON.parse(JSON.stringify(read.model));
      if (estimates === 'ambulance') {
        means ??= ambulanceMeans();
        for (const node of json.orphans)
          if (means.has(node.id))
            node.customProperties = {
              ...node.customProperties,
              Probability: String(means.get(node.id)),
            };
      }
      return kaosModelOf(json);
    };
    out.push(
      ...selectionOracle(
        modelOf,
        rows.filter((r) => r.model === model),
      ).map((r) => ({ file: model, ...r })),
    );
  }
  const failing = out.filter((r) => r.status === 'fail');
  return {
    seed: 'ADS corpus',
    mode: 'kaosres',
    checks: {
      oracle: {
        status: failing.length ? 'fail' : 'pass',
        detail: `${out.length - failing.length}/${out.length} rows`,
      },
    },
    rows: out,
  };
};

/** Two sets of resources, the same files by kind and path, whatever their order. */
const sameResources = (a, b) => {
  const flat = (r) =>
    JSON.stringify(
      Object.entries(r)
        .flatMap(([kind, files]) =>
          Object.entries(files).map(([p, text]) => [kind, p, text]),
        )
        .sort(),
    );
  return flat(a) === flat(b);
};

/** A check that runs `fn`: its result, or its error as a failure. */
const check = (fn) => {
  try {
    return fn();
  } catch (error) {
    return { status: 'fail', detail: errorText(error) };
  }
};

const checkSeed = (name) => {
  const dir = path.join(SEEDS_DIR, name);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, 'project.json'), 'utf8'),
  );
  const [entry] = manifest.models;
  const kaosFile = entry.native?.kaos;
  const modelText = fs.readFileSync(path.join(dir, entry.path), 'utf8');
  const kaos = fs.readFileSync(path.join(dir, kaosFile), 'utf8');
  const modelName = path.basename(entry.path, '.txt');
  const committed = Object.fromEntries(
    Object.entries(manifest.projectResources).map(([kind, paths]) => [
      kind,
      Object.fromEntries(
        [paths]
          .flat()
          .map((p) => [p, fs.readFileSync(path.join(dir, p), 'utf8')]),
      ),
    ]),
  );
  const read = lib.kaosNativeFile.read(kaos, { modelName });
  const checks = {};
  checks.import = check(() => {
    if (!read.model)
      return {
        status: 'fail',
        detail: read.diagnostics.map((d) => d.message).join('; '),
      };
    const problems = [];
    if (json(read.model) !== modelText)
      problems.push(`${entry.path} is not the .kaos read`);
    if (read.dialectRecord.engine !== manifest.dialect)
      problems.push(
        `opens in ${read.dialectRecord.engine}, the project is ${manifest.dialect}'s`,
      );
    if (!sameResources(read.dialectRecord.projectResources, committed))
      problems.push('its resources are not the committed files');
    return problems.length
      ? { status: 'fail', detail: problems.join('; ') }
      : {
          status: 'pass',
          detail: `${read.diagnostics.length} diagnostic(s); mode ${manifest.dialect}`,
        };
  });
  checks.validate = check(() => {
    const issues = core.validateModel(
      core.parsePistar(modelText, { metamodel: KAOS_OBSTACLES }),
    );
    return issues.length
      ? {
          status: 'fail',
          detail: issues.map((i) => i.message ?? String(i)).join('; '),
        }
      : { status: 'pass' };
  });
  checks.roundtrip = check(() => {
    const written = lib.kaosNativeFile.write(JSON.parse(modelText), {
      modelName,
      projectResources: committed,
    });
    if (written.text === null)
      return {
        status: 'fail',
        detail: written.diagnostics.map((d) => d.message).join('; '),
      };
    const again = lib.kaosNativeFile.read(written.text, { modelName });
    const trip = lib.modelRoundTrip(lib.kaosNativeFile, JSON.parse(modelText), {
      modelName,
      projectResources: committed,
    });
    const problems = [];
    if (!trip.ok) problems.push(trip.problem);
    if (!sameResources(again.dialectRecord?.projectResources ?? {}, committed))
      problems.push('its resources read back differently');
    return problems.length
      ? { status: 'fail', detail: problems.join('; ') }
      : {
          status: 'pass',
          detail: `${written.text.split('\n').length} lines written`,
        };
  });
  checks.analyses = check(() => {
    const ran = [];
    for (const [id, analysis] of Object.entries(lib.kaospropAnalyses)) {
      const out = lib.runAnalysis(analysis, analysisModelOf(modelText));
      if ('error' in out)
        return { status: 'fail', detail: `kaosprop ${id}: ${out.error}` };
      ran.push(`kaosprop ${id}: ${out.result.cases.length} case(s)`);
    }
    for (const [id, analysis] of Object.entries(lib.kaosresAnalyses)) {
      const out = lib.runAnalysis(
        analysis,
        lib.kaosresAnalysisModel(lib.readKaosObstacleModel(modelText)),
      );
      if ('error' in out)
        return { status: 'fail', detail: `kaosres ${id}: ${out.error}` };
      ran.push(`kaosres ${id}: ${out.result.cases.length} case(s)`);
    }
    for (const [id, analysis] of Object.entries(lib.kaosexpertAnalyses)) {
      const out = lib.runAnalysis(
        analysis,
        expertModelOf(modelText),
        undefined,
        {
          resources: committed,
          options: { samples: 2000, seed: 1 },
        },
      );
      if ('error' in out)
        return { status: 'fail', detail: `kaosexpert ${id}: ${out.error}` };
      ran.push(`kaosexpert ${id}: ${out.result.cases.length} case(s)`);
    }
    return { status: 'pass', detail: ran.join('; ') };
  });
  const oracleFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.expected.csv'));
  const rows = [];
  for (const file of oracleFiles) {
    const csv = readCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!csv.length) continue;
    if ('selection' in csv[0])
      rows.push(
        ...selectionOracle(() => kaosModelOf(JSON.parse(modelText)), csv).map(
          (r) => ({ file, ...r }),
        ),
      );
    else if ('probability' in csv[0]) {
      // las.expected.csv is RE'12's hand-drawn model's (its header says so)
      const text =
        name === 'las' ? fs.readFileSync(LAS_FIXTURE, 'utf8') : modelText;
      rows.push(...kaospropOracle(text, csv).map((r) => ({ file, ...r })));
    } else
      rows.push(
        ...expertOracle(modelText, committed, csv).map((r) => ({ file, ...r })),
      );
  }
  if (rows.length) {
    const failing = rows.filter((r) => r.status === 'fail');
    checks.oracle = {
      status: failing.length ? 'fail' : 'pass',
      detail: `${rows.length - failing.length}/${rows.length} rows`,
    };
  } else checks.oracle = { status: 'skip', detail: 'no expected CSV' };
  // kaosprop's rows, read under kaosexpert with point estimates: each sample is its EPS
  const degenerate = rows.filter((r) => r.kaosexpert !== undefined);
  if (degenerate.length && name === 'las') {
    const off = degenerate.filter(
      (r) => Math.abs(r.kaosexpert - Number(r.expected)) > 1e-6,
    );
    checks.degenerate = off.length
      ? {
          status: 'fail',
          detail: off.map((r) => `${r.id} ${r.kaosexpert}`).join('; '),
        }
      : {
          status: 'pass',
          detail: `${degenerate.length} rows, kaosexpert = kaosprop`,
        };
  }
  return { seed: name, mode: manifest.dialect, checks, rows };
};

const markdown = (results, exitCode) => {
  const lines = [
    '# KAOS stress test',
    '',
    `Generated ${new Date().toISOString()}; exit ${exitCode}${strict ? ' (strict)' : ''}.`,
    '',
    '| Seed | Mode | import | validate | roundtrip | analyses | oracle | degenerate |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.seed} | ${r.mode} | ${[
          'import',
          'validate',
          'roundtrip',
          'analyses',
          'oracle',
          'degenerate',
        ]
          .map((c) =>
            r.checks[c]
              ? `${ICON[r.checks[c].status]} ${cell(r.checks[c].detail ?? '')}`
              : '',
          )
          .join(' | ')} |`,
    ),
    '',
  ];
  for (const r of results.filter((r) => r.rows.length)) {
    lines.push(
      `## ${r.seed}`,
      '',
      '| File | Quantity | Id | Expected | Got | Paper | Data | |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const row of r.rows)
      lines.push(
        `| ${row.file} | ${cell(row.quantity)} | ${cell(row.id)} | ${cell(row.expected)}${row.tolerance ? ` ± ${row.tolerance}` : ''} | ${cell(row.got)} | ${cell(row.paper)} | ${cell(row.data)} | ${ICON[row.status]} ${cell((row.problems ?? []).join('; '))} |`,
      );
    lines.push('');
  }
  return lines.join('\n');
};

const main = () => {
  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const results = [...SEEDS.map(checkSeed), checkCorpus()];
  for (const result of results) {
    fs.writeFileSync(path.join(RESULTS, `${result.seed}.json`), json(result));
    console.log(
      `${result.seed.padEnd(16)} ${Object.entries(result.checks)
        .map(([name, c]) => `${name}:${c.status}`)
        .join(' ')}`,
    );
    for (const row of result.rows.filter((r) => r.status === 'fail'))
      console.log(
        `  ❌ ${row.file} ${row.quantity} ${row.id}: ${(row.problems ?? []).join('; ')}`,
      );
  }
  const failing = results.filter((r) =>
    Object.values(r.checks).some((c) => c.status === 'fail'),
  );
  const exitCode = strict && failing.length ? 1 : 0;
  fs.writeFileSync(
    path.join(RESULTS, 'SUMMARY.md'),
    markdown(results, exitCode),
  );
  console.log(
    `results in ${path.relative(ROOT, RESULTS)} (SUMMARY.md, one JSON per seed)`,
  );
  if (failing.length)
    console.log(`failing: ${failing.map((r) => r.seed).join(', ')}`);
  return exitCode;
};

process.exit(main());

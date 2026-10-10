/**
 * The checks of #32's "Stress test" table, on one model: whether it parses,
 * round-trips through the notation and passes the dialect's checks; its MDP,
 * PCTL files, formulas and eval_formula.sh (its lines as a set) against
 * the reference; generation time and size;
 * and (when PRISM or Storm is on PATH) whether the MDP builds.
 *
 * Each check is `{ status, ...details }`, status one of:
 * - `pass`, `fail`;
 * - `skipped`: it needs something absent (a tool on PATH);
 * - `unavailable`: it needs the engine, or a step before it failed.
 */
const { buildMdp } = require('./build.cjs');
const {
  compareBytes,
  compareFormulas,
  compareLineSets,
  diffMdp,
} = require('./compare.cjs');
const { PCTL, outputRoles } = require('./references.cjs');

/**
 * The dialect's diagnostics each model is expected to have (`check: message`),
 * as a model PR settles them (#36 to #40); none listed: none expected.
 */
const EXPECTED_DIAGNOSTICS = {};

const unavailable = (reason) => ({ status: 'unavailable', reason });
const status = (ok) => (ok ? 'pass' : 'fail');
const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Read the piStar model, its view and its Notation view document. */
const readModel = ({ core, goalTree, language }, engine, reference) => {
  const model = core.parsePistar(reference.text);
  const view = goalTree.goalView(model, engine.definition);
  const doc = language.notationDocument(engine.definition, view);
  const context = language.contextFromView(engine.definition, view, []);
  const runCheck = (name, properties, self) =>
    engine.checks[name]?.(properties, language.checkContextOf(context, self)) ??
    null;
  const diagnostics = language
    .documentDiagnostics(engine.definition, doc.text, context, { runCheck })
    .map((d) => ({
      severity: d.severity,
      message: d.message,
      ...(d.elementId && { elementId: d.elementId }),
      ...(d.check && { check: d.check }),
      text: doc.text.slice(d.from, d.to),
    }));
  return { model, view, doc, diagnostics };
};

/** Every check on one model; `engine` null: the engine's checks are unavailable. */
const checkModel = (
  deps,
  engine,
  reference,
  { runs = 3, build = true } = {},
) => {
  const { goalTree, language } = deps;
  const checks = {};
  if (!engine) {
    const why = unavailable('the GODA dialect is not in the built lib (#32)');
    for (const name of [
      'parses',
      'roundTrip',
      'dialectChecks',
      'generates',
      'mdp',
      'pctl',
      'reliability',
      'cost',
      'evalScript',
      'performance',
      'build',
    ])
      checks[name] = why;
    return checks;
  }

  // the goal language on the model's Notation view document
  let read = null;
  try {
    read = readModel(deps, engine, reference);
  } catch (error) {
    checks.parses = { status: 'fail', error: errorText(error) };
  }
  if (read) {
    const languageErrors = read.diagnostics.filter(
      (d) => d.severity === 'error' && !d.check,
    );
    checks.parses = {
      status: status(languageErrors.length === 0),
      errors: languageErrors,
      warnings: read.diagnostics.filter(
        (d) => d.severity !== 'error' && !d.check,
      ),
    };
    // piStar → notation → piStar: the document asks for no edit, and lists every element it should
    const edits = language.notationEdits(
      engine.definition,
      read.doc.text,
      read.view,
    );
    const listed = new Set(read.doc.ids);
    const notListed = [...read.view.nodes.values()]
      .filter(
        (node) => engine.definition.elements[node.kind] && !listed.has(node.id),
      )
      .map((node) => node.id);
    checks.roundTrip = {
      status: status(edits.length === 0 && notListed.length === 0),
      edits,
      notListed,
    };
    const got = read.diagnostics
      .filter((d) => d.check)
      .map((d) => `${d.check}: ${d.message}`)
      .sort();
    const expected = [...(EXPECTED_DIAGNOSTICS[reference.name] ?? [])].sort();
    checks.dialectChecks = {
      status: status(JSON.stringify(got) === JSON.stringify(expected)),
      got,
      expected,
    };
  } else {
    checks.roundTrip = unavailable('the model did not read');
    checks.dialectChecks = unavailable('the model did not read');
  }

  // the engine: generated `runs` times, timed, with the reference's generator version
  let output = null;
  const times = [];
  if (!engine.output)
    checks.generates = unavailable('godaOutput is not in the built lib (#32)');
  else if (!engine.implements(reference.variant))
    checks.generates = {
      status: 'fail',
      error: `variant not implemented: the reference comes from upstream ${reference.variant} (#34 D10)`,
    };
  else
    try {
      const model = goalTree.Model.validate(
        deps.core.parsePistar(reference.text),
      );
      for (let i = 0; i < runs; i += 1) {
        const started = process.hrtime.bigint();
        output = engine.output(model, {
          modelName: reference.modelName,
          variant: reference.variant,
        });
        times.push(Number(process.hrtime.bigint() - started) / 1e6);
      }
      checks.generates = {
        status: 'pass',
        files: output.files.map((file) => file.fileName),
      };
    } catch (error) {
      checks.generates = {
        status: 'fail',
        error: errorText(error),
        // what the engine doesn't generate yet, by its own account (the issue that will)
        ...(error?.name === 'GodaUnsupported' && { unsupported: true }),
      };
    }
  if (!output) {
    // a failed check before: the ones that need the output can't run
    for (const name of [
      'mdp',
      'pctl',
      'reliability',
      'cost',
      'evalScript',
      'performance',
      'build',
    ])
      checks[name] = unavailable(
        `no output: ${checks.generates.error ?? checks.generates.reason}`,
      );
    return checks;
  }

  const ours = outputRoles(output.files);
  const missing = (what) => ({
    status: 'fail',
    error: `no ${what} in the output`,
  });
  checks.mdp = ours.mdp
    ? (() => {
        const diff = diffMdp(ours.mdp.text, reference.reference.mdp.text);
        // named after the actor, as the reference is (AND.nm)
        const named = ours.mdp.fileName === reference.reference.mdp.fileName;
        return {
          status: status(diff.equal && named),
          fileName: ours.mdp.fileName,
          ...(!named && {
            referenceFileName: reference.reference.mdp.fileName,
          }),
          ...diff,
        };
      })()
    : missing('.nm file');
  const pctl = Object.fromEntries(
    PCTL.map((name) => [
      name,
      ours.pctl[name]
        ? compareBytes(ours.pctl[name].text, reference.reference.pctl[name])
        : { equal: false, error: 'missing' },
    ]),
  );
  checks.pctl = {
    status: status(Object.values(pctl).every((file) => file.equal)),
    files: pctl,
  };
  for (const kind of ['reliability', 'cost']) {
    const file = ours[kind];
    if (!file) {
      checks[kind] = missing(`${kind}.out`);
      continue;
    }
    const result = compareFormulas(file.text, reference.reference[kind], {
      evalValues: reference.reference.evalValues,
    });
    checks[kind] = { status: status(result.equal), ...result };
  }
  // upstream writes it from a HashMap: its lines are compared as a set (#34 D15)
  checks.evalScript = ours.evaluate
    ? (() => {
        const result = compareLineSets(
          ours.evaluate.text,
          reference.reference.evalScript,
        );
        return { status: status(result.equal), ...result };
      })()
    : missing('eval_formula.sh');
  const size = output.files.reduce(
    (sum, file) => sum + Buffer.byteLength(file.text, 'utf8'),
    0,
  );
  checks.performance = {
    status: 'pass',
    milliseconds: { median: median(times), runs: times },
    bytes: { ours: size, reference: reference.reference.size },
    // upstream publishes no generation times for these examples
    upstream: null,
  };
  checks.build =
    build && ours.mdp
      ? buildMdp(ours.mdp.text, reference.reference.evalValues)
      : { status: 'skipped', reason: build ? 'no .nm file' : 'not asked for' };
  return checks;
};

/** The checks that need a binary on PATH (the rest must pass for AND and OR). */
const EXTERNAL = new Set(['build']);

module.exports = { EXPECTED_DIAGNOSTICS, EXTERNAL, checkModel, readModel };

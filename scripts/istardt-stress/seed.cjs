/**
 * The iStar-DT stress test's checks on one seed (goal-controller#119),
 * through lib's built `out/`:
 *
 * - **import**: `importIstardt` gives a model and no `error` diagnostic;
 * - **model** (a committed seed): the project's model is the import's, as
 *   `projects.cjs --write` writes it;
 * - **checks**: `istardtProblems` finds no error (its warnings counted);
 * - **dtgolog**: the writer's file equals the golden one after the four
 *   header lines, byte for byte (#117 D1.1);
 * - **oracle** (`--oracle`): DT-Golog's utility and policy for ours equal the
 *   golden's, or the committed `reference/utility.txt` (our own model).
 *
 * Each check is `{ status, ...details }`, status `pass`, `fail` or `skip`
 * (with its `reason`).
 */
const fs = require('fs');
const { modelText } = require('./projects.cjs');

const HEADER_LINES = 4;

const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

/** A file after its header: what is compared. */
const body = (text) => text.split('\n').slice(HEADER_LINES).join('\n');

/** The first line two texts differ on (1-based, after the header). */
const firstDifference = (ours, theirs) => {
  const a = body(ours).split('\n');
  const b = body(theirs).split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i])
      return {
        line: i + 1 + HEADER_LINES,
        ours: a[i] ?? '(end of file)',
        golden: b[i] ?? '(end of file)',
      };
  return null;
};

const skip = (reason) => ({ status: 'skip', reason });

/** Import, checks and DT-Golog of a seed; the program, for the oracle. */
const checkSeed = ({ lib, core }, seed) => {
  const checks = {};
  let program = null;
  const text = fs.readFileSync(seed.source, 'utf8');
  const result = lib.importIstardt(text, { modelName: seed.modelName });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  checks.import = result.model
    ? errors.length
      ? { status: 'fail', errors: errors.map((d) => d.message) }
      : {
          status: 'pass',
          warnings: result.diagnostics.filter((d) => d.severity === 'warning')
            .length,
        }
    : { status: 'fail', errors: result.diagnostics.map((d) => d.message) };
  if (!result.model) return { checks, program };

  if (seed.committed)
    checks.model = !fs.existsSync(seed.model)
      ? { status: 'fail', error: 'the project has no model' }
      : fs.readFileSync(seed.model, 'utf8') === modelText(result.model)
        ? { status: 'pass' }
        : {
            status: 'fail',
            error:
              'the committed model is not the import (projects.cjs --write)',
          };

  let model;
  try {
    model = lib.readIstardtModel(
      lib.analysisModel(
        core.parsePistar(result.model, { fileMetamodel: true }),
      ),
    );
  } catch (error) {
    checks.checks = { status: 'fail', error: errorText(error) };
    return { checks, program };
  }
  const problems = lib.istardtProblems(model);
  const failing = problems.filter((p) => p.severity === 'error');
  checks.checks = failing.length
    ? { status: 'fail', errors: failing.map((p) => p.message) }
    : {
        status: 'pass',
        warnings: problems.filter((p) => p.severity === 'warning').length,
        infos: problems.filter((p) => p.severity === 'info').length,
      };

  try {
    program = lib.istardtTemplate(model, {
      modelName: seed.modelName,
      continuous: result.dialectRecord.options?.continuous ?? true,
    });
  } catch (error) {
    checks.dtgolog = { status: 'fail', error: errorText(error) };
    return { checks, program };
  }
  if (!seed.golden) checks.dtgolog = skip('no golden file: the oracle’s run');
  else if (!fs.existsSync(seed.golden))
    checks.dtgolog = skip('golden file missing (fetch)');
  else {
    const golden = fs.readFileSync(seed.golden, 'utf8');
    const difference = firstDifference(program, golden);
    checks.dtgolog = difference
      ? { status: 'fail', difference }
      : { status: 'pass', lines: program.split('\n').length };
  }
  return { checks, program };
};

/** The oracle's check: ours against the golden's run, or the committed utility. */
const oracleCheck = (seed, { ours, golden }, committedUtility) => {
  if (!ours) return skip('not run (--oracle)');
  // DT-Golog failing on the golden file the same way: the model's, not ours
  const kind = (error) => /^error\((\w+\(\w*\)?)/.exec(error)?.[1] ?? error;
  if (ours.error && golden?.error && kind(ours.error) === kind(golden.error))
    return skip(
      `DT-Golog fails on the golden file the same way: ${kind(golden.error)}`,
    );
  if (ours.error) return { status: 'fail', error: `ours: ${ours.error}` };
  const reference = golden ?? committedUtility;
  if (!reference)
    return skip('no reference (golden run or reference/utility.txt)');
  if (reference.error)
    return { status: 'fail', error: `golden: ${reference.error}` };
  const same =
    ours.utility === reference.utility &&
    ours.probability === reference.probability &&
    (reference.policy === undefined || ours.policy === reference.policy);
  return {
    status: same ? 'pass' : 'fail',
    utility: ours.utility,
    probability: ours.probability,
    reference: {
      utility: reference.utility,
      probability: reference.probability,
    },
  };
};

module.exports = { checkSeed, firstDifference, oracleCheck, HEADER_LINES };

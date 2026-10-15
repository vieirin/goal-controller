/**
 * The native file check (goal-controller#144 item 1): each seed's model
 * written back as a `.jucm` by the GRL dialect's native file (`writeJucm`),
 * then
 *
 * - **round trip**: lib's `modelRoundTrip` (the written file reads to the
 *   seed's model but for the format's `lossy` paths), the same strategies
 *   read back, and the same bytes when it is written again;
 * - **oracle** (with `--oracle`): jUCMNav, in Docker, evaluates the written
 *   file exactly as it evaluates the seed: every row of the seed's reference
 *   equal in the written file's, for every strategy and run.
 *
 * The written files go to `.cache/grl/native/<id>.jucm`, jUCMNav's CSVs of
 * them to `.cache/grl/native-reference/<id>.csv`.
 */
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { CACHE } = require('./fetch.cjs');
const { readReference } = require('./compare.cjs');

const NATIVE = path.join(CACHE, 'native');
const NATIVE_REFERENCE = path.join(CACHE, 'native-reference');

/** GRL's native file, as its dialect declares it */
const jucmOf = (lib) => lib.grl.nativeFiles.jucm;

/** A seed's model written as a `.jucm`, or null when the seed doesn't import. */
const writeNative = (lib, text, modelName) => {
  const file = jucmOf(lib);
  const imported = file.read(text, { modelName });
  if (!imported.model) return null;
  const context = {
    modelName,
    projectResources: imported.dialectRecord.projectResources,
  };
  return { imported, context, ...file.write(imported.model, context) };
};

/** Writes each seed's native file into NATIVE, for the oracle to evaluate. */
const writeNativeSeeds = (lib, seeds) => {
  fs.rmSync(NATIVE, { recursive: true, force: true });
  fs.mkdirSync(NATIVE, { recursive: true });
  for (const seed of seeds) {
    if (!fs.existsSync(seed.file)) continue;
    const native = writeNative(
      lib,
      fs.readFileSync(seed.file, 'utf8'),
      seed.id,
    );
    if (native)
      fs.writeFileSync(path.join(NATIVE, `${seed.id}.jucm`), native.text);
  }
  return NATIVE;
};

/** Two references' rows, keyed by run, strategy, kind and id. */
const compareReferences = (seed, native) => {
  const flat = (reference) =>
    new Map(
      [...reference.rows].flatMap(([key, rows]) =>
        rows.map((row) => [
          `${key}|${row.kind}|${row.id}`,
          `${row.value} ${row.label}`,
        ]),
      ),
    );
  const expected = flat(seed);
  const got = flat(native);
  const differences = [...expected]
    .filter(([key, value]) => got.get(key) !== value)
    .map(
      ([key, value]) =>
        `${key}: seed ${value}, written ${got.get(key) ?? 'none'}`,
    );
  const extra = [...got.keys()].filter((key) => !expected.has(key));
  return {
    status: differences.length || extra.length ? 'fail' : 'pass',
    equal: expected.size - differences.length,
    rows: expected.size,
    ...(differences.length && { differences: differences.slice(0, 20) }),
    ...(extra.length && { extra: extra.slice(0, 20) }),
  };
};

/**
 * The native check on one seed: `{ status, roundTrip, oracle, diagnostics }`;
 * `reference` is the seed's (references.cjs's `loadReference`).
 */
const checkNative = (lib, seedId, text, reference) => {
  let native;
  try {
    native = writeNative(lib, text, seedId);
  } catch (error) {
    return { status: 'fail', error: `writeJucm: ${error.message}` };
  }
  if (!native) return { status: 'skip', reason: 'the seed did not import' };
  const file = jucmOf(lib);
  const trip = lib.modelRoundTrip(file, native.imported.model, native.context);
  const back = file.read(native.text, native.context);
  const again =
    back.model &&
    file.write(back.model, {
      ...native.context,
      projectResources: back.dialectRecord.projectResources,
    });
  const problems = [
    ...(trip.ok ? [] : [trip.problem]),
    ...(back.model &&
    !isDeepStrictEqual(back.dialectRecord, native.imported.dialectRecord)
      ? ['the written file imports to other strategies']
      : []),
    ...(again && again.text !== native.text
      ? ['writing it again gives other bytes']
      : []),
  ];
  const roundTrip = problems.length
    ? { status: 'fail', error: problems.join('; ') }
    : { status: 'pass' };

  const csv = path.join(NATIVE_REFERENCE, `${seedId}.csv`);
  let oracle;
  if (reference.skip)
    oracle = { status: 'skip', reason: 'the seed has no reference' };
  else if (!fs.existsSync(csv))
    oracle = { status: 'skip', reason: 'not evaluated (run --oracle)' };
  else {
    const written = readReference(fs.readFileSync(csv, 'utf8'));
    oracle = written.skip
      ? {
          status: 'fail',
          error: `jUCMNav, on the written file: ${written.skip}`,
        }
      : compareReferences(reference, written);
  }
  const statuses = [roundTrip.status, oracle.status];
  return {
    status: statuses.includes('fail') ? 'fail' : 'pass',
    roundTrip,
    oracle,
    ...(native.diagnostics.length && {
      diagnostics: native.diagnostics.map((d) => d.message),
    }),
  };
};

module.exports = { NATIVE, NATIVE_REFERENCE, checkNative, writeNativeSeeds };

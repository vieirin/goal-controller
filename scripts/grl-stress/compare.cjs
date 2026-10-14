/**
 * The oracle's CSV, read, and a strategy's evaluations against it: exact
 * integer values and exact labels, each row of the reference (every
 * intentional element and actor jUCMNav evaluates) against ours.
 */

/** The oracle's runs (docker/jucmnav/OracleTest.java's RUNS), keyed `algorithm/tolerance`. */
const RUNS = [
  { key: 'quantitative/0', algorithm: 'quantitative', tolerance: 0 },
  { key: 'quantitative/10', algorithm: 'quantitative', tolerance: 10 },
  { key: 'qualitative/0', algorithm: 'qualitative', tolerance: 0 },
];

/** One CSV line's fields: quoted ones may hold commas and `""`. */
const fields = (line) => {
  const out = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = '';
      i += 1;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (line[i] === '"') {
          i += 1;
          break;
        } else value += line[i++];
      }
      out.push(value);
      i += 1; // the comma
    } else {
      const end = line.indexOf(',', i);
      const stop = end === -1 ? line.length : end;
      out.push(line.slice(i, stop));
      i = stop + 1;
    }
  }
  return out;
};

const HEADER = 'algorithm,tolerance,strategy,strategyName,kind,id,value,label';

/**
 * A reference CSV: `{ rows: Map<'<run>|<strategy>', row[]> }`, or
 * `{ skip: reason }` when the oracle didn't load the seed (its `ERROR` line)
 * or the file isn't the oracle's.
 */
const readReference = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.length);
  if (lines[0]?.startsWith('ERROR,'))
    return { skip: `the oracle did not load it: ${fields(lines[0])[1]}` };
  if (lines[0] !== HEADER)
    return { skip: `not the oracle's CSV (header ${lines[0] ?? 'missing'})` };
  const rows = new Map();
  for (const line of lines.slice(1)) {
    const [algorithm, tolerance, strategy, , kind, id, value, label] =
      fields(line);
    const key = `${algorithm}/${tolerance}|${strategy}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ kind, id, value: Number(value), label });
  }
  return { rows };
};

/**
 * A strategy under each run against the reference: per run `pass` (every
 * row equal), `fail` (with the first differences), or `skip` with a reason.
 * `evaluate(strategy, run)` is lib's evaluation.
 */
const compareStrategy = (strategy, evaluate, reference) => {
  const runs = {};
  for (const run of RUNS) {
    if (reference.skip) {
      runs[run.key] = reference.fatal
        ? { status: 'fail', error: reference.skip }
        : { status: 'skip', reason: reference.skip };
      continue;
    }
    const rows = reference.rows.get(`${run.key}|${strategy.id}`);
    if (!rows) {
      runs[run.key] = {
        status: 'skip',
        reason: 'the reference has no rows for it',
      };
      continue;
    }
    let ours;
    try {
      ours = evaluate(strategy, run);
    } catch (error) {
      runs[run.key] = {
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
      };
      continue;
    }
    const differences = [];
    for (const row of rows) {
      const got = (row.kind === 'actor' ? ours.actors : ours.elements).get(
        row.id,
      );
      if (!got || got.value !== row.value || (got.label ?? '') !== row.label)
        differences.push({
          kind: row.kind,
          id: row.id,
          jucmnav: { value: row.value, label: row.label },
          ours: got ? { value: got.value, label: got.label ?? '' } : null,
        });
    }
    runs[run.key] = {
      status: differences.length ? 'fail' : 'pass',
      equal: rows.length - differences.length,
      rows: rows.length,
      ...(differences.length && { differences: differences.slice(0, 20) }),
    };
  }
  return { id: strategy.id, name: strategy.name, runs };
};

module.exports = { RUNS, compareStrategy, fields, readReference };

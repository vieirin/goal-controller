/**
 * The stress scripts' `native` column (goal-controller#143): a seed's model
 * through its engine's native files, as the round-trip contract checks it
 * (lib's `modelRoundTrip`: written and read back, the model but for what
 * the format can't carry). Skipped while the engine's dialect declares no
 * native file, or only ones it reads (goal-controller#144 adds the writers,
 * and each script's file round trips against its tool).
 */

/**
 * `{ status: 'pass' | 'fail' | 'skip', … }` for one seed's model: each
 * native file with a writer round-trips it. `written`: the text each wrote
 * (by native file id), for a script's own checks on it (its tool, as
 * oracle).
 */
const nativeCheck = (lib, dialect, model, context) => {
  const writable = Object.entries(dialect?.nativeFiles ?? {}).filter(
    ([, file]) => file.write,
  );
  if (!writable.length)
    return {
      status: 'skip',
      reason: Object.keys(dialect?.nativeFiles ?? {}).length
        ? 'its native files are read only'
        : 'no native file declared',
    };
  const written = {};
  const failures = writable.flatMap(([id, file]) => {
    try {
      const trip = lib.modelRoundTrip(file, model, context);
      if (trip.written !== null) written[id] = trip.written;
      return trip.ok ? [] : [`${id}: ${trip.problem}`];
    } catch (error) {
      return [`${id}: ${error instanceof Error ? error.message : error}`];
    }
  });
  return failures.length
    ? { status: 'fail', error: failures[0], failures, written }
    : { status: 'pass', files: writable.map(([id]) => id), written };
};

const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };

/** The column's cell. */
const nativeCell = (check) =>
  !check
    ? ''
    : check.status === 'skip'
      ? `${ICON.skip} ${check.reason}`
      : check.status === 'fail'
        ? `${ICON.fail} ${check.error}`
        : `${ICON.pass} ${check.files.join(', ')}`;

module.exports = { nativeCheck, nativeCell };

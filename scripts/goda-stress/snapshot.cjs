/**
 * The regression step: the language snapshot (scripts/language-snapshot.cjs)
 * of the other engines against a baseline taken on the base commit. The
 * GODA files (named `goda__…`) are left out: only the other engines must not
 * change.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT = path.join(ROOT, 'scripts', 'language-snapshot.cjs');

const take = (directory) => {
  fs.rmSync(directory, { recursive: true, force: true });
  execFileSync(process.execPath, [SNAPSHOT, directory], { stdio: 'inherit' });
};

const files = (directory) => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory()
        ? walk(file)
        : [path.relative(directory, file)];
    });
  return walk(directory)
    .filter((file) => !path.basename(file).startsWith('goda__'))
    .sort();
};

/** The files that changed, appeared or went between two snapshots. */
const compareSnapshots = (before, after) => {
  const a = files(before);
  const b = files(after);
  const changed = a.filter(
    (file) =>
      b.includes(file) &&
      !fs
        .readFileSync(path.join(before, file))
        .equals(fs.readFileSync(path.join(after, file))),
  );
  return {
    files: b.length,
    changed,
    added: b.filter((file) => !a.includes(file)),
    removed: a.filter((file) => !b.includes(file)),
  };
};

/**
 * The snapshot now against the baseline in `baseline`. Without one, the
 * check is skipped and says how to take it (`--save-baseline` on the base
 * commit).
 */
const checkRegressions = ({ baseline, current }) => {
  if (!fs.existsSync(baseline))
    return {
      status: 'skipped',
      reason: `no baseline in ${path.relative(ROOT, baseline)}: run with --save-baseline on the base commit first`,
    };
  take(current);
  const result = compareSnapshots(baseline, current);
  const regressions =
    result.changed.length + result.added.length + result.removed.length;
  return { status: regressions === 0 ? 'pass' : 'fail', ...result };
};

module.exports = { checkRegressions, compareSnapshots, take };

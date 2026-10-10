/**
 * The optional build check: PRISM or Storm builds the MDP when one of them
 * is on PATH (skipped otherwise), and says how many states and transitions
 * it has. The model's constants get eval_formula.sh's values; one it doesn't
 * give gets 0.5, and is listed.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const onPath = (binary) => {
  const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [
    binary,
  ]);
  return found.status === 0;
};

/** The undefined constants of a PRISM model (`const double R_G1_T1_1;`). */
const undefinedConstants = (mdp) =>
  [...mdp.matchAll(/^\s*const\s+(?:double|int|bool)\s+(\w+)\s*;/gm)].map(
    ([, name]) => name,
  );

const count = (output, label) => {
  const match = new RegExp(`${label}:\\s*(\\d+)`).exec(output);
  return match ? Number(match[1]) : null;
};

/** Build the MDP with the first tool found; `{ status: 'skipped' }` without one. */
const buildMdp = (mdp, evalValues, { tools = ['storm', 'prism'] } = {}) => {
  const tool = tools.find(onPath);
  if (!tool)
    return {
      status: 'skipped',
      reason: `none of ${tools.join(', ')} is on PATH`,
    };
  const names = undefinedConstants(mdp);
  const defaulted = names.filter((name) => evalValues[name] === undefined);
  const constants = names
    .map((name) => `${name}=${evalValues[name] ?? 0.5}`)
    .join(',');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goda-build-'));
  const file = path.join(dir, 'model.nm');
  fs.writeFileSync(file, mdp);
  const args =
    tool === 'storm'
      ? ['--prism', file, ...(constants ? ['--constants', constants] : [])]
      : [file, ...(constants ? ['-const', constants] : [])];
  try {
    const output = execFileSync(tool, args, {
      encoding: 'utf8',
      timeout: 10 * 60 * 1000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
      status: 'pass',
      tool,
      states: count(output, 'States'),
      transitions: count(output, 'Transitions'),
      defaulted,
    };
  } catch (error) {
    return {
      status: 'fail',
      tool,
      error: String(error.stdout || error.stderr || error.message).slice(-2000),
      defaulted,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

module.exports = { buildMdp, undefinedConstants };

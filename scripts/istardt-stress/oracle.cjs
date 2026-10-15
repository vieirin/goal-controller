/**
 * DT-Golog itself as the iStar-DT oracle (#117 D1.2): `docker/dtgolog`,
 * never on the host. Each seed's program (ours) and its golden one are run
 * with `bp(root, 10, …)` (the program's own `dtgRun`); their utility and
 * policy must be the same. `*_Trials.py`'s optimal utilities (dtg2sim, on
 * the hand-written RLGen specs) are compared too, for information only.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { CACHE } = require('./fetch.cjs');

const ROOT = path.join(__dirname, '..', '..');
const ORACLE = path.join(CACHE, 'oracle');
const SPECS = path.join(ORACLE, 'specs');
const OUT = path.join(ORACLE, 'out');

/**
 * dtg2sim's optimal expected rewards (`*_Trials.py` at `ed424ff`), by the
 * fixture whose model is the same: informational (#117 D1.2).
 */
const TRIALS = {
  '1.Order': { utility: 0.9235, from: 'discrete/1Order_Trials.py' },
  '2.1.Build_1R_Discrete': {
    utility: 0.476,
    from: 'discrete/3SBuild_Trials.py',
  },
  '2.4.Build_1R_Mixed': { utility: 0.476, from: 'discrete/3SBuild_Trials.py' },
  'istardt-order': { utility: 0.9235, from: 'discrete/1Order_Trials.py' },
};

/** A result file's utility, probability and policy (or its error). */
const readResult = (file) => {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const field = (name) => new RegExp(`^${name}: (.*)$`, 'm').exec(text)?.[1];
  const error = /^ERROR: (.*)$/m.exec(text)?.[1];
  return error
    ? { error }
    : {
        utility: Number(field('Utility')),
        probability: Number(field('Probability')),
        policy: field('Policy'),
      };
};

/** Runs DT-Golog (Docker) on every seed's programs: `<id>.pl` ours, `<id>-Auth.pl` the golden. */
const runOracle = (programs) => {
  fs.rmSync(ORACLE, { recursive: true, force: true });
  fs.mkdirSync(SPECS, { recursive: true });
  for (const { id, ours, golden } of programs) {
    if (ours) fs.writeFileSync(path.join(SPECS, `${id}.pl`), ours);
    if (golden) fs.writeFileSync(path.join(SPECS, `${id}-Auth.pl`), golden);
  }
  execFileSync(path.join(ROOT, 'docker/dtgolog/run.sh'), [SPECS, OUT], {
    stdio: 'inherit',
  });
};

/** What the oracle said of a seed: ours, the golden's, and the trials'. */
const oracleOf = (id) => ({
  ours: readResult(path.join(OUT, `${id}.txt`)),
  golden: readResult(path.join(OUT, `${id}-Auth.txt`)),
  trials: TRIALS[id] ?? null,
});

module.exports = { ORACLE, OUT, TRIALS, oracleOf, readResult, runOracle };

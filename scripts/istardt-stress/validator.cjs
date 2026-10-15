/**
 * dtx2dtg's validator as the iStarDT-X writer's oracle (goal-controller#144
 * item 2): `docker/dtx2dtg` (the XSD, then the Schematron) run on what the
 * native column wrote of each seed, in Docker, never on the host. A seed's
 * result is `VALID`, or `INVALID` and what dtx2dtg said.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { CACHE } = require('./fetch.cjs');

const ROOT = path.join(__dirname, '..', '..');
const WRITTEN = path.join(CACHE, 'validator', 'written');
const OUT = path.join(CACHE, 'validator', 'results');

/** Validates each written file (`{ id, text }`); a check per id. */
const runValidator = (written) => {
  fs.rmSync(path.join(CACHE, 'validator'), { recursive: true, force: true });
  fs.mkdirSync(WRITTEN, { recursive: true });
  for (const { id, text } of written)
    fs.writeFileSync(path.join(WRITTEN, `${id}.istardtx`), text);
  execFileSync(path.join(ROOT, 'docker/dtx2dtg/run.sh'), [WRITTEN, OUT], {
    stdio: 'inherit',
  });
  return Object.fromEntries(
    written.map(({ id }) => {
      const at = path.join(OUT, `${id}.txt`);
      const said = fs.existsSync(at) ? fs.readFileSync(at, 'utf8') : null;
      return [
        id,
        said === null
          ? { status: 'fail', error: 'no result from the validator' }
          : said.startsWith('VALID')
            ? { status: 'pass' }
            : {
                status: 'fail',
                error: said.split('\n').slice(1).join(' ').slice(0, 300),
              },
      ];
    }),
  );
};

module.exports = { runValidator };

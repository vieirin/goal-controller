// The rule layer's times on #63's fixtures (goal-controller#74): preparing
// the rules once, then per evaluation (as each keystroke runs it) creating an
// engine, loading the facts as rows, reasoning and reading the results.
// Medians of 15 evaluations (3 at 2,200 elements), after a warm-up.
//
//   pnpm --filter @goal-controller/lib run build && node scripts/rulesTimings.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const nemo = require('nemo-wasm');
const { prepareRules, evaluateRules, FactSet } = require('../out/rules');

const FIXTURES = path.join(__dirname, '..', 'test', 'rules', 'fixtures');
const SCENARIOS = [
  ['GODA BSN', 'bsn.json'],
  ['tas3-edgev2', 'tas3-edgev2.json'],
  ['GODA Fragmented', 'fragmented.json'],
  ['medicine-delivery', 'medicine-delivery.json'],
  ['synthetic, 2,200 elements', 'synthetic.json.gz'],
];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => x.toFixed(2);

(async () => {
  console.log(
    '| Project | Facts | Prepare (once) | Engine | Load facts | Reason | Read | Evaluation |',
  );
  console.log('|---|---|---|---|---|---|---|---|');
  for (const [label, file] of SCENARIOS) {
    const raw = fs.readFileSync(path.join(FIXTURES, file));
    const fixture = JSON.parse(
      (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'),
    );
    const ruleFile = fs.readFileSync(
      path.join(FIXTURES, `${fixture.engine}.rls`),
      'utf8',
    );
    let at = performance.now();
    const rules = prepareRules(nemo, [ruleFile]);
    const prepare = performance.now() - at;
    const facts = new FactSet();
    for (const [relation, row] of fixture.tuples)
      facts.add(relation.replace(/\./g, '_'), ...row);
    const runs = facts.size > 10000 ? 3 : 15;
    await evaluateRules(rules, facts);
    const t = { engine: [], facts: [], reason: [], read: [], total: [] };
    for (let i = 0; i < runs; i += 1) {
      at = performance.now();
      const { timings } = await evaluateRules(rules, facts);
      t.total.push(performance.now() - at);
      for (const key of ['engine', 'facts', 'reason', 'read'])
        t[key].push(timings[key]);
    }
    rules.free();
    console.log(
      `| ${label} | ${facts.size} | ${ms(prepare)} ms | ${ms(median(t.engine))} ms | ${ms(median(t.facts))} ms | ${ms(median(t.reason))} ms | ${ms(median(t.read))} ms | ${ms(median(t.total))} ms |`,
    );
  }
})();

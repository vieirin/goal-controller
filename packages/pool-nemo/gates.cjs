// #72's gates 1 and 3, re-run on the vieirin/nemo fork's bindings (#73):
// the rules are prepared once (NemoProgram), and each keystroke loads the
// facts as rows (addFacts / setFacts), reasons and reads the problems.
//
//   node gates.cjs                 gate 1 + gate 3 on every fixture
//   node gates.cjs bsn,synthetic   only these fixtures
//   node gates.cjs --text          also time #72's text path (NemoEngine.new)
//
// fixtures/*.json are #63's rules, extracted facts and derived results per
// scenario (dumped by #72 from #63's FactPool): `rules` in #63's Datalog
// syntax, `tuples` as [relation, values], `problems` and the `resolves` count.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { NemoEngine, NemoProgram } = require('nemo-wasm');

const FIXTURES = path.join(__dirname, 'fixtures');
const args = process.argv.slice(2);
const textPath = args.includes('--text');
const only = args.find((a) => !a.startsWith('--'))?.split(',');

/** #63's Datalog text → Nemo's syntax (mechanical: the same rules; from #72) */
const toNemo = (rule) => {
  const TOKEN =
    /\s+|%[^\n]*|:-|!=|<=|>=|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*|[(),.!=<>]/y;
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < rule.length) {
    const m = TOKEN.exec(rule);
    if (!m) throw new Error(`bad token in ${rule}`);
    if (!/^\s|^%/.test(m[0])) tokens.push(m[0]);
  }
  const out = [];
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.startsWith("'")) out.push(JSON.stringify(t.slice(1, -1)));
    else if (t === '!' || t === 'not') out.push('~');
    // Nemo can't order strings: #63's `X < Y` (symmetry breaking) becomes `!=`, same results
    else if (t === '<' && /^[A-Z_]/.test(tokens[i - 1]) && /^[A-Z_]/.test(next))
      out.push('!=');
    else if (/^[A-Za-z_]/.test(t) && next === '(') out.push(predicate(t));
    else if (t === '_') out.push('_');
    else if (/^[A-Z_]/.test(t)) out.push(`?${t}`);
    else if (/^[a-z]/.test(t)) out.push(JSON.stringify(t));
    else out.push(t);
  });
  return out
    .join(' ')
    .replace(/ \( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/ ,/g, ',');
};
/** Nemo doesn't allow dots in predicate names */
const predicate = (relation) => relation.replace(/\./g, '_');

const rulesOf = (scenario) =>
  `${scenario.rules.map(toNemo).join('\n')}\n@output problem .\n@output resolves .`;
/** the facts as rows per predicate: what the editor would hand to Nemo on a keystroke */
const rowsOf = (tuples) => {
  const rows = new Map();
  for (const [relation, tuple] of tuples) {
    const name = predicate(relation);
    let list = rows.get(name);
    if (!list) rows.set(name, (list = []));
    list.push(tuple);
  }
  return rows;
};
const textOf = (scenario) => {
  const value = (v) =>
    typeof v === 'number' ? String(v) : JSON.stringify(String(v));
  const facts = scenario.tuples.map(
    ([r, t]) => `${predicate(r)}(${t.map(value).join(', ')}) .`,
  );
  return `${rulesOf(scenario)}\n${facts.join('\n')}`;
};

const keysOf = (rows) =>
  [...new Set(rows.map((r) => r.map(String).join('|')))].sort();
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => `${x.toFixed(2)} ms`;

const load = (name) => {
  const file = path.join(FIXTURES, `${name}.json`);
  const json = fs.existsSync(file)
    ? fs.readFileSync(file)
    : zlib.gunzipSync(fs.readFileSync(`${file}.gz`));
  return JSON.parse(json);
};
const names = (
  only ??
  fs
    .readdirSync(FIXTURES)
    .filter((f) => /\.json(\.gz)?$/.test(f))
    .map((f) => f.replace(/\.json(\.gz)?$/, ''))
).sort();

(async () => {
  let failures = 0;
  const check = (label, ok, detail) => {
    if (!ok) failures += 1;
    if (!ok) console.log(`  FAIL ${label}`, detail ?? '');
  };

  // prepared once per rule set (the editor: once per engine definition)
  const programs = new Map();
  const programOf = (scenario) => {
    const text = rulesOf(scenario);
    if (!programs.has(text)) {
      const start = performance.now();
      const program = new NemoProgram(text);
      programs.set(text, { program, prepare: performance.now() - start });
    }
    return programs.get(text);
  };

  console.log(
    '| scenario | engine | facts | gate 1 problems | resolves | prepare (once) | createEngine | addFacts | reason | read | keystroke | kept engine: setFacts + reason + read |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const scenarios = new Map(names.map((n) => [n, load(n)]));
  for (const [name, scenario] of scenarios) {
    const { program, prepare } = programOf(scenario);
    const expected = keysOf(scenario.problems);

    // gate 1, a fresh engine from the prepared program
    let problems;
    let resolves;
    {
      using engine = await program.createEngine();
      for (const [p, rows] of rowsOf(scenario.tuples)) engine.addFacts(p, rows);
      await engine.reason();
      problems = keysOf(await engine.getResultRows('problem'));
      resolves = (await engine.getResultRows('resolves')).length;
    }
    const same = JSON.stringify(problems) === JSON.stringify(expected);
    check(`${name}: problems`, same, { expected, got: problems });
    check(`${name}: resolves`, resolves === scenario.resolves, {
      expected: scenario.resolves,
      got: resolves,
    });

    // gate 3: a keystroke on a fresh engine (createEngine + addFacts, reason, read the problems)
    // medians of 15 (3 at 2,200 elements), after warm-up runs: an editor session is
    // warm after a few keystrokes, and the WASM needs ~10 runs to tier up
    const runs = scenario.tuples.length > 10000 ? 3 : 15;
    const warmup = scenario.tuples.length > 10000 ? 1 : 10;
    const t = { create: [], add: [], reason: [], read: [], total: [] };
    for (let i = -warmup; i < runs; i += 1) {
      const s0 = performance.now();
      const engine = await program.createEngine();
      const sc = performance.now();
      for (const [p, rows] of rowsOf(scenario.tuples)) engine.addFacts(p, rows);
      const s1 = performance.now();
      await engine.reason();
      const s2 = performance.now();
      const rows = await engine.getResultRows('problem');
      const s3 = performance.now();
      engine.free();
      if (i < 0) continue; // warm-up
      check(
        `${name}: run ${i}`,
        JSON.stringify(keysOf(rows)) === JSON.stringify(expected),
      );
      t.create.push(sc - s0);
      t.add.push(s1 - sc);
      t.reason.push(s2 - s1);
      t.read.push(s3 - s2);
      t.total.push(s3 - s0);
    }

    // the same keystroke on one long-lived engine: setFacts replaces the rows, then re-reason
    const kept = [];
    {
      using engine = await program.createEngine();
      for (const [p, rows] of rowsOf(scenario.tuples)) engine.addFacts(p, rows);
      await engine.reason();
      for (let i = -warmup; i < runs; i += 1) {
        const s0 = performance.now();
        for (const [p, rows] of rowsOf(scenario.tuples))
          engine.setFacts(p, rows);
        await engine.reason();
        const rows = await engine.getResultRows('problem');
        if (i >= 0) kept.push(performance.now() - s0);
        check(
          `${name}: kept run ${i}`,
          JSON.stringify(keysOf(rows)) === JSON.stringify(expected),
        );
      }
    }

    console.log(
      `| ${name} | ${scenario.engine} | ${scenario.tuples.length} | ${same ? 'SAME' : 'DIFF'} (${problems.length}/${expected.length}) | ${resolves}/${scenario.resolves} | ${ms(prepare)} | ${ms(median(t.create))} | ${ms(median(t.add))} | ${ms(median(t.reason))} | ${ms(median(t.read))} | **${ms(median(t.total))}** | ${ms(median(kept))} |`,
    );
  }

  // a sequence of edits on one engine: each oracle case in turn, through setFacts
  // (predicates a case has no facts for are emptied), against each case's expected problems
  const oracle = [...scenarios.keys()].filter((n) => n.startsWith('oracle-'));
  if (oracle.length > 1) {
    const { program } = programOf(scenarios.get(oracle[0]));
    using engine = await program.createEngine();
    const seen = new Set();
    let steps = 0;
    for (const round of [oracle, [...oracle].reverse()])
      for (const name of round) {
        const scenario = scenarios.get(name);
        const rows = rowsOf(scenario.tuples);
        for (const p of seen) if (!rows.has(p)) engine.setFacts(p, []);
        for (const [p, r] of rows) {
          engine.setFacts(p, r);
          seen.add(p);
        }
        await engine.reason();
        const got = keysOf(await engine.getResultRows('problem'));
        const resolves = (await engine.getResultRows('resolves')).length;
        check(
          `edit sequence ${name}`,
          JSON.stringify(got) === JSON.stringify(keysOf(scenario.problems)) &&
            resolves === scenario.resolves,
          { got, resolves },
        );
        steps += 1;
      }
    console.log(
      `\nedit sequence: ${steps} setFacts steps over the ${oracle.length} oracle cases on one engine`,
    );
  }

  if (textPath) {
    console.log(
      '\n#72 text path (NemoEngine.new with the facts as program text), for comparison:',
    );
    for (const [name, scenario] of scenarios) {
      const runs = scenario.tuples.length > 10000 ? 3 : 15;
      const times = [];
      for (let i = scenario.tuples.length > 10000 ? 0 : -3; i < runs; i += 1) {
        const s0 = performance.now();
        using engine = await NemoEngine.new(textOf(scenario));
        await engine.reason();
        await engine.getResultRows('problem');
        if (i >= 0) times.push(performance.now() - s0);
      }
      console.log(`  ${name.padEnd(36)} ${ms(median(times))}`);
    }
  }

  for (const { program } of programs.values()) program.free();
  console.log(failures ? `\n${failures} FAILED` : '\nall gate 1 checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

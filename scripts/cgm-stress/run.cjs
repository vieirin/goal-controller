#!/usr/bin/env node
/**
 * The contextual goal models stress test (goal-controller#153), one command:
 *
 *   pnpm stress:cgm                              # builds lib, then runs this
 *   node scripts/cgm-stress/run.cjs [--strict] [--oracle]
 *
 * Every seed is committed (examples/cgm/<seed>/, a project): nothing to
 * fetch. For each seed, through lib's built `out/`:
 *
 * - **import**: the piStar file, read with its metamodel block, as the
 *   analyses read it (`cgmAnalysisModel`);
 * - **checks**: `cgmProblems` finds nothing;
 * - **notation**: the Notation view document reads back to the same model
 *   (`notationEdits` gives no edit) and has no diagnostic;
 * - **resources**: its situations and relations read without a problem;
 * - **dlv**: RE-Context's encoding (`reContextDlv`, Codes 2–4) is the
 *   committed `reference/*.dlv`, per situation too;
 * - **analyses**: the engine's four analyses run without error.
 *
 * Then #151's reference results, exactly, from the seeds (an erratum is
 * reported as "paper prints X, the formula gives Y", and passes when the
 * formula's value is what we get).
 *
 * With `--oracle`, docker/dlv (DLV 2.1.2 and z3, in Docker only):
 * - DLV's answer sets of each seed's Code 2 are the TS enumerator's
 *   variants, each its elements and its contexts, as sets;
 * - DLV's Code 4 totals Fig. 13's tasks as #151 D11 does (340, 215);
 * - z3 re-checks every satisfiability, equivalence and implication verdict
 *   the analyses take on the seeds' relations.
 *
 * Writes SUMMARY.md and a JSON per seed to .cache/cgm/results/. Exits
 * non-zero only with `--strict`, on a failure.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SEEDS_DIR = path.join(ROOT, 'examples', 'cgm');
const CACHE = path.join(ROOT, '.cache', 'cgm');
const RESULTS = path.join(CACHE, 'results');
const pkg = (name) => path.join(ROOT, 'packages', name);
const lib = require(path.join(pkg('lib'), 'out/index.js'));
const language = require(path.join(pkg('goal-language'), 'out/cjs/index.cjs'));
const goalTree = require(path.join(pkg('goal-tree'), 'out/index.js'));
const core = require(
  require.resolve('@istar-ts/core', { paths: [pkg('goal-tree')] }),
);

const strict = process.argv.includes('--strict');
const oracle = process.argv.includes('--oracle');
const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };
/** text in a Markdown table's cell: its pipes escaped */
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
const errorText = (error) =>
  error instanceof Error ? error.message : String(error);
const SEEDS = fs
  .readdirSync(SEEDS_DIR)
  .filter((name) => fs.existsSync(path.join(SEEDS_DIR, name, 'project.json')))
  .sort();

/** A check's result: pass when `run` returns without throwing, its value the detail. */
const check = (run) => {
  try {
    const detail = run();
    return { status: 'pass', ...(detail !== undefined && { detail }) };
  } catch (error) {
    return { status: 'fail', error: errorText(error) };
  }
};
const expectEqual = (actual, expected, what) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
};

/** A seed: its model, read every way the stress test reads it. */
const loadSeed = (seed) => {
  const dir = path.join(SEEDS_DIR, seed);
  const json = JSON.parse(
    fs.readFileSync(path.join(dir, `${seed}.txt`), 'utf8'),
  );
  const istar = core.parsePistar(json, { fileMetamodel: true });
  const resource = (kind) =>
    fs.existsSync(path.join(dir, kind))
      ? Object.fromEntries(
          fs
            .readdirSync(path.join(dir, kind))
            .sort()
            .map((file) => [
              `${kind}/${file}`,
              fs.readFileSync(path.join(dir, kind, file), 'utf8'),
            ]),
        )
      : {};
  const files = (record) =>
    Object.entries(record).map(([p, text]) => ({ path: p, text }));
  const situations = resource('situations');
  const relations = resource('relations');
  const model = lib.cgmAnalysisModel(istar);
  return {
    dir,
    istar,
    model,
    cgm: lib.readCgmModel(model),
    situationFiles: situations,
    relationFiles: relations,
    situations: lib.readCgmSituations(files(situations)).situations,
    relations: lib.readCgmRelations(files(relations)).relations,
  };
};

/** The checks every seed gets. */
const seedChecks = (seed, s) => {
  const view = goalTree.goalView(s.istar, lib.cgm);
  const { text } = language.notationDocument(lib.cgm, view);
  const model = language.contextFromView(lib.cgm, view, []);
  const runCheck = (name, properties, self) =>
    lib.cgmCheckRegistry[name]?.(
      properties,
      language.checkContextOf(model, self),
    ) ?? null;
  return {
    import: check(
      () =>
        `${s.model.elements.length} elements, ${s.model.links.length} links`,
    ),
    checks: check(() => {
      const problems = lib.cgmProblems(s.model);
      if (problems.length)
        throw new Error(problems.map((p) => p.message).join('; '));
      return 'none';
    }),
    notation: check(() => {
      const edits = language.notationEdits(lib.cgm, text, view);
      if (edits.length) throw new Error(`edits: ${JSON.stringify(edits)}`);
      const diagnostics = language.documentDiagnostics(lib.cgm, text, model, {
        runCheck,
      });
      if (diagnostics.length)
        throw new Error(diagnostics.map((d) => d.message).join('; '));
      return `${text.split('\n').length} lines`;
    }),
    resources: check(() => {
      const problems = [
        ...lib.cgmProjectResourceParsers.situations(
          Object.entries(s.situationFiles).map(([p, t]) => ({
            path: p,
            text: t,
          })),
        ).diagnostics,
        ...lib.cgmProjectResourceParsers.relations(
          Object.entries(s.relationFiles).map(([p, t]) => ({
            path: p,
            text: t,
          })),
        ).diagnostics,
      ];
      if (problems.length)
        throw new Error(problems.map((d) => d.message).join('; '));
      return `${s.situations.length} situations, ${s.relations.length} relation files`;
    }),
    dlv: check(() => {
      const reference = (name) =>
        fs.readFileSync(path.join(s.dir, 'reference', `${name}.dlv`), 'utf8');
      expectEqual(lib.reContextDlv(s.model), reference(seed), 'Code 2');
      for (const situation of s.situations)
        expectEqual(
          lib.reContextDlv(s.model, { situation }),
          reference(path.basename(situation.path, '.json')),
          `Code 3, ${situation.path}`,
        );
      return `${1 + s.situations.length} programs`;
    }),
    analyses: check(() => {
      const counts = Object.entries(lib.cgmAnalyses).map(([id, analysis]) => {
        const input =
          analysis.input === 'situations' ? s.situationFiles : s.relationFiles;
        const run = lib.runAnalysis(analysis, s.model, input);
        if ('error' in run) throw new Error(`${id}: ${run.error}`);
        return `${id} ${run.result.cases.length}`;
      });
      const variants = lib
        .cgmVariants(s.cgm)
        .reduce((n, { total }) => n + total, 0);
      return `${variants} variants; cases: ${counts.join(', ')}`;
    }),
  };
};

const tasksText = (s, variant) => lib.variantName(s.cgm, variant);
const caseOf = (result, label) =>
  result.cases.filter((c) => c.label.includes(label));

/**
 * #151's reference results (1–4) and the errata, each a row: what the
 * paper gives, what we get.
 */
const referenceRows = (seeds) => {
  const costs = seeds['museum-guide-costs'];
  const museum = seeds['museum-guide'];
  const home = seeds['smart-home'];
  const rows = [];
  const row = (id, title, paper, run) => {
    const result = check(run);
    rows.push({ id, title, paper, ...result });
  };

  row(
    'R1',
    'Fig. 13: minimum-cost tasks (§5.3, Fig. 12)',
    'tasks {T1,T4,T5,T7,T8,T9}, cost 215, implemented {V2,V5,V6}; all tasks 340',
    () => {
      const all = lib.cgmVariants(costs.cgm).flatMap((r) => r.variants);
      const [fig13] = costs.relations;
      const { groups, nonCore } = lib.coreGroups(
        costs.cgm,
        all,
        fig13.absolute,
      );
      expectEqual(
        groups.map((g) => g.map((v) => tasksText(costs, v))),
        [
          ['{T1, T3}', '{T1, T4}', '{T2, T3}', '{T2, T4}'],
          ['{T5, T8, T9}'],
          ['{T7, T8, T9}'],
        ],
        'core groups (V1–V4, V5, V6)',
      );
      const result = lib.minimumCostTasks(costs.cgm, groups);
      expectEqual(
        result.tasks.map(costs.cgm.idOf),
        ['T1', 'T4', 'T5', 'T7', 'T8', 'T9'],
        'tasks',
      );
      expectEqual(result.cost, 215, 'cost');
      expectEqual(result.allTasksCost, 340, 'cost of all tasks');
      expectEqual(
        result.implemented.map((v) => tasksText(costs, v)),
        ['{T1, T4}', '{T5, T8, T9}', '{T7, T8, T9}'],
        'implemented (V2, V5, V6)',
      );
      return `tasks {${result.tasks.map(costs.cgm.idOf).join(',')}}, cost ${result.cost}, implemented {V2,V5,V6}; all tasks ${result.allTasksCost}; ${nonCore.length} non-core`;
    },
  );
  row(
    'E-Fig13-noncore',
    'Fig. 13 erratum: the non-core variants',
    'NV1 {T6,T10}, NV2 {T6,T11}, "both can be replaced by V2"',
    () => {
      const all = lib.cgmVariants(costs.cgm).flatMap((r) => r.variants);
      const { nonCore } = lib.coreGroups(
        costs.cgm,
        all,
        costs.relations[0].absolute,
      );
      const got = nonCore.map(
        ({ variant, replacedBy }) =>
          `${tasksText(costs, variant)}→${tasksText(costs, replacedBy)}`,
      );
      expectEqual(
        got,
        [
          '{T5, T10}→{T5, T8, T9}',
          '{T5, T11}→{T5, T8, T9}',
          '{T6, T8, T9}→{T5, T8, T9}',
          '{T6, T10}→{T5, T8, T9}',
          '{T6, T11}→{T5, T8, T9}',
          '{T7, T10}→{T7, T8, T9}',
          '{T7, T11}→{T7, T8, T9}',
        ],
        'non-core',
      );
      return `paper prints 2 non-core replaced by V2; the formula gives 7, replaced by V5 {T5,T8,T9} or V6 {T7,T8,T9}: ${got.join(', ')}`;
    },
  );
  row(
    'R2',
    'Code 3: the best variant for a situation (§4)',
    "G10's variant 4, G11's −2: G10 chosen",
    () => {
      const result = lib.runAnalysis(
        lib.cgmAnalyses.cgmVariants,
        costs.model,
        costs.situationFiles,
      ).result;
      const cases = caseOf(result, 'Code 3');
      const scores = cases.map((c) => [
        c.label.replace(/^.*: /, ''),
        c.summary.replace(/;.*/, ''),
      ]);
      expectEqual(
        scores,
        [
          ['#1 {T5, T8, T9}', 'score 4'],
          ['#2 {T5, T10}', 'score -2'],
          ['#3 {T5, T11}', 'score -2'],
        ],
        'ranking',
      );
      return "G10's variant {T5,T8,T9} 4, G11's {T5,T10} and {T5,T11} −2: G10 first";
    },
  );
  row(
    'E-Ex1',
    'Example 1 erratum (§4, Fig. 7): C14 false, comfort 4, well informed 3',
    'priority(v′) = 1, priority(v″) = −1, v′ selected',
    () => {
      const result = lib.runAnalysis(
        lib.cgmAnalyses.cgmVariants,
        museum.model,
        museum.situationFiles,
      ).result;
      const scores = caseOf(result, 'Example 1').map((c) => [
        c.label.replace(/^.*: /, ''),
        c.summary.replace(/;.*/, ''),
      ]);
      expectEqual(
        scores,
        [
          ['#1 {T6, T10}', 'score 1'],
          ['#2 {T6, T11}', 'score 1'],
          ['#3 {T6, T8, T9}', 'score -1'],
        ],
        'ranking',
      );
      return 'paper prints v′ (in person) 1, v″ (by call) −1; the formula gives in person −1, by call +1: by call first';
    },
  );
  row(
    'R3',
    'Fig. 3: the context of a variant',
    'C0 ∧ ¬C2 ∧ ¬C3 ∧ C1 ∧ C6 ∧ C10 ∧ C11; C14 decides its quality',
    () => {
      const all = lib.cgmVariants(museum.cgm).flatMap((r) => r.variants);
      const id = (x) => museum.cgm.byId(x).id;
      const fig3 = all.filter(
        (v) =>
          tasksText(museum, v) === '{T7, T8, T9}' &&
          !v.elements.includes(id('G14')) &&
          !v.elements.includes(id('G15')),
      );
      expectEqual(fig3.length, 1, 'the variant');
      const text = lib.contextText(museum.cgm, fig3[0]);
      expectEqual(text, 'C0 ∧ ¬C2 ∧ ¬C3 ∧ C1 ∧ C6 ∧ C10 ∧ C11', 'context');
      const quality = museum.cgm.contributions
        .filter(
          (l) => fig3[0].elements.includes(l.source) && l.properties.context,
        )
        .map((l) => l.properties.context);
      expectEqual(quality, ['C14'], 'quality contexts');
      return `${text}; quality C14`;
    },
  );
  row(
    'R4a',
    'Example 2: under wp8.1 → ¬wp7.1, C7 → ¬C8',
    'C7 → ¬C8; a variant with C7 ∧ C8 is never applicable',
    () => {
      const rel = museum.relations[0];
      const read = language.readAssertion;
      const assumptions = rel.absolute.map((r) =>
        lib.expandToFacts(r.tree, museum.cgm.lookup),
      );
      const entailment = lib.implies(
        lib.expandToFacts(read('C7'), museum.cgm.lookup),
        lib.expandToFacts(read('!C8'), museum.cgm.lookup),
        assumptions,
      );
      expectEqual(entailment.holds, true, 'C7 → ¬C8');
      const all = lib.cgmVariants(museum.cgm).flatMap((r) => r.variants);
      const both = all.filter((v) => {
        const held = v.literals
          .filter((l) => l.holds && l.condition.kind === 'var')
          .map((l) => l.condition.variable);
        return held.includes('C7') && held.includes('C8');
      });
      const unsat = both.filter(
        (v) =>
          !lib.satisfiable(lib.factContext(museum.cgm, v), assumptions)
            .satisfiable,
      );
      expectEqual(
        unsat.length,
        both.length,
        'every C7 ∧ C8 variant unadoptable',
      );
      return `C7 → ¬C8 holds; ${both.length} variants with C7 ∧ C8, all unadoptable`;
    },
  );
  row(
    'R4b',
    'Example 3, Fig. 9: a variant unsatisfiable through C7 against C1',
    "Fig. 9's variant (C7 ∧ ¬C8 under C2, with C3, C1, C4, C9) has an unsatisfiable context",
    () => {
      const all = lib.cgmVariants(museum.cgm).flatMap((r) => r.variants);
      const rel = museum.relations[0];
      const assumptions = rel.absolute.map((r) =>
        lib.expandToFacts(r.tree, museum.cgm.lookup),
      );
      const fig9 = all.filter(
        (v) =>
          tasksText(museum, v) === '{T14, T16, T18, T19}' &&
          lib.contextText(museum.cgm, v).includes('¬C8') &&
          !lib.contextText(museum.cgm, v).includes('¬C3'),
      );
      expectEqual(fig9.length, 1, "Fig. 9's variant");
      const result = lib.satisfiable(
        lib.factContext(museum.cgm, fig9[0]),
        assumptions,
      );
      expectEqual(result.satisfiable, false, 'satisfiable');
      const conflict = result.conflict.map((i) => rel.absolute[i].text);
      expectEqual(conflict, ['!F7.1 | !F1.1'], 'the conflicting relation');
      return `${lib.contextText(museum.cgm, fig9[0])}: unsatisfiable with ${conflict.join(', ')}`;
    },
  );
  row(
    'IST-Ex1',
    'IST 2013 Example 1, Fig. 6: ϕ1 against ϕ7',
    'a variant activating G1 (ϕ1) and G6 (ϕ7) has an inconsistent activation context',
    () => {
      const all = lib.cgmVariants(home.cgm).flatMap((r) => r.variants);
      const assumptions = home.relations[0].absolute.map((r) =>
        lib.expandToFacts(r.tree, home.cgm.lookup),
      );
      const both = all.filter((v) => {
        const held = v.literals
          .filter((l) => l.holds && l.condition.kind === 'var')
          .map((l) => l.condition.variable);
        return held.includes('C1') && held.includes('C7');
      });
      if (!both.length) throw new Error('no variant with ϕ1 and ϕ7');
      const consistent = both.filter(
        (v) =>
          lib.satisfiable(lib.factContext(home.cgm, v), assumptions)
            .satisfiable,
      );
      expectEqual(consistent.length, 0, 'consistent ϕ1 ∧ ϕ7 variants');
      return `${both.length} variants with ϕ1 ∧ ϕ7, all inconsistent`;
    },
  );
  return rows;
};

/** DLV's answer sets as variants: their element and context atoms. */
const dlvVariant = (atoms) =>
  atoms
    .filter((a) => !/^(drop|cost|needed|total|phi|softgoal|contrib)\b/.test(a))
    .map((a) => a.replace(/^(ach|todo)\((.*)\)$/, '$2'))
    .sort()
    .join(' ');
const tsVariant = (s, variant) =>
  [
    ...new Set([
      ...variant.elements.map((id) => lib.dlvConstant(s.cgm.idOf(id))),
      ...variant.literals.map((literal) => lib.dlvGuardAtom(literal)),
    ]),
  ]
    .sort()
    .join(' ');

/** The oracle (docker/dlv): DLV's variants and costs, z3's verdicts. */
const oracleRows = (seeds) => {
  const jobs = path.join(CACHE, 'jobs');
  const out = path.join(CACHE, 'oracle');
  fs.rmSync(jobs, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(jobs, { recursive: true });
  const checks = [];
  const verdicts = {};
  for (const [seed, s] of Object.entries(seeds)) {
    fs.writeFileSync(
      path.join(jobs, `${seed}.dlv`),
      lib.reContextDlv(s.model, { costs: false }),
    );
    const all = lib.cgmVariants(s.cgm).flatMap((r) => r.variants);
    for (const { id, relations } of lib.relationCases(s.relations)) {
      const assumptions = relations.map((r) =>
        lib.expandToFacts(r.tree, s.cgm.lookup),
      );
      const add = (kind, label, trees, verdict) => {
        const key = `${seed}|${id}|${kind}|${label}`;
        const smt = trees.map(lib.smtFormula);
        checks.push({
          id: key,
          kind,
          atoms: lib.smtAtoms([...trees, ...assumptions]),
          ...(kind === 'satisfiable'
            ? { formula: smt[0] }
            : { a: smt[0], b: smt[1] }),
          assumptions: assumptions.map(lib.smtFormula),
        });
        verdicts[key] = verdict;
      };
      const contexts = all.map(
        (v) => lib.factContext(s.cgm, v) ?? { kind: 'bool', value: true },
      );
      contexts.forEach((context, i) =>
        add(
          'satisfiable',
          `v${i}`,
          [context],
          lib.satisfiable(context, assumptions).satisfiable,
        ),
      );
      // Fig. 10's implications and equivalences between the satisfiable variants' groups
      const { groups, nonCore } = lib.coreGroups(s.cgm, all, relations);
      const firstOf = (v) => contexts[all.indexOf(v)];
      for (const group of groups)
        for (const v of group.slice(1))
          add(
            'equivalent',
            `v${all.indexOf(group[0])}~v${all.indexOf(v)}`,
            [firstOf(group[0]), firstOf(v)],
            lib.equivalent(firstOf(group[0]), firstOf(v), assumptions).holds,
          );
      for (const a of groups)
        for (const b of groups)
          if (a !== b)
            add(
              'implies',
              `v${all.indexOf(a[0])}>v${all.indexOf(b[0])}`,
              [firstOf(a[0]), firstOf(b[0])],
              lib.implies(firstOf(a[0]), firstOf(b[0]), assumptions).holds,
            );
      for (const { variant, replacedBy } of nonCore)
        add(
          'implies',
          `v${all.indexOf(variant)}>v${all.indexOf(replacedBy)}`,
          [firstOf(variant), firstOf(replacedBy)],
          lib.implies(firstOf(variant), firstOf(replacedBy), assumptions).holds,
        );
    }
  }
  // Code 4 against #151 D11's rule
  const costs = seeds['museum-guide-costs'];
  const taskIds = (ids) => ids.map((id) => costs.cgm.byId(id).id);
  const allTasks = costs.model.elements
    .filter((e) => e.kind === 'istar.Task')
    .map((e) => e.id);
  fs.writeFileSync(
    path.join(jobs, 'costs-all.dlv'),
    lib.reContextCosts(costs.model, allTasks),
  );
  fs.writeFileSync(
    path.join(jobs, 'costs-answer.dlv'),
    lib.reContextCosts(
      costs.model,
      taskIds(['T1', 'T4', 'T5', 'T7', 'T8', 'T9']),
    ),
  );
  fs.writeFileSync(path.join(jobs, 'checks.json'), JSON.stringify({ checks }));
  execFileSync(path.join(ROOT, 'docker/dlv/run.sh'), [jobs, out], {
    stdio: 'inherit',
  });
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  const rows = [];
  for (const [seed, s] of Object.entries(seeds))
    rows.push({
      id: `dlv-${seed}`,
      title: `DLV's answer sets of ${seed}'s Code 2 = the TS enumerator's variants`,
      ...check(() => {
        const result = read(`${seed}.json`);
        if (result.error) throw new Error(result.error);
        const theirs = [...new Set(result.models.map(dlvVariant))].sort();
        const ours = [
          ...new Set(
            lib
              .cgmVariants(s.cgm)
              .flatMap((r) => r.variants)
              .map((v) => tsVariant(s, v)),
          ),
        ].sort();
        const missing = ours.filter((v) => !theirs.includes(v));
        const extra = theirs.filter((v) => !ours.includes(v));
        if (missing.length || extra.length)
          throw new Error(
            `only ours: ${missing.slice(0, 3).join(' / ')}; only DLV's: ${extra.slice(0, 3).join(' / ')} (${missing.length}, ${extra.length})`,
          );
        return `${ours.length} variants, equal`;
      }),
    });
  for (const [name, expected] of [
    ['costs-all', 340],
    ['costs-answer', 215],
  ])
    rows.push({
      id: `dlv-${name}`,
      title: `DLV's Code 4 total, ${name === 'costs-all' ? 'all tasks' : "Fig. 13's answer"}`,
      ...check(() => {
        const [model] = read(`${name}.json`).models;
        const total = model.find((a) => a.startsWith('total('));
        expectEqual(total, `total(${expected})`, 'total');
        return total;
      }),
    });
  rows.push({
    id: 'z3',
    title: "z3 re-checks the analyses' verdicts",
    ...check(() => {
      const z3 = read('checks.out.json');
      const differ = Object.entries(verdicts).filter(
        ([key, ours]) => z3[key] !== ours,
      );
      if (differ.length)
        throw new Error(
          `${differ.length} differ: ${differ
            .slice(0, 3)
            .map(([key, ours]) => `${key} ours ${ours}, z3 ${z3[key]}`)
            .join('; ')}`,
        );
      const kinds = {};
      for (const c of checks) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
      return `${checks.length} verdicts agree (${Object.entries(kinds)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ')})`;
    }),
  });
  return rows;
};

const main = () => {
  fs.mkdirSync(RESULTS, { recursive: true });
  const seeds = Object.fromEntries(SEEDS.map((seed) => [seed, loadSeed(seed)]));
  const perSeed = Object.fromEntries(
    SEEDS.map((seed) => [seed, seedChecks(seed, seeds[seed])]),
  );
  const references = referenceRows(seeds);
  const oracleResults = oracle ? oracleRows(seeds) : [];
  const columns = [
    'import',
    'checks',
    'notation',
    'resources',
    'dlv',
    'analyses',
  ];
  const lines = [
    '# Contextual goal models stress test (goal-controller#153)',
    '',
    `| seed | ${columns.join(' | ')} |`,
    `|---|${columns.map(() => '---').join('|')}|`,
    ...SEEDS.map(
      (seed) =>
        `| ${seed} | ${columns
          .map((c) => {
            const r = perSeed[seed][c];
            return `${ICON[r.status]} ${cell(r.detail ?? r.error)}`;
          })
          .join(' | ')} |`,
    ),
    '',
    "## #151's reference results",
    '',
    '| id | result | paper | ours |',
    '|---|---|---|---|',
    ...references.map(
      (r) =>
        `| ${r.id} | ${cell(r.title)} | ${cell(r.paper)} | ${ICON[r.status]} ${cell(r.detail ?? r.error)} |`,
    ),
    '',
    '## Oracle (docker/dlv: DLV 2.1.2, z3)',
    '',
    ...(oracle
      ? [
          '| id | check | result |',
          '|---|---|---|',
          ...oracleResults.map(
            (r) =>
              `| ${r.id} | ${cell(r.title)} | ${ICON[r.status]} ${cell(r.detail ?? r.error)} |`,
          ),
        ]
      : ['Not run: pass `--oracle` (Docker).']),
    '',
  ];
  fs.writeFileSync(path.join(RESULTS, 'SUMMARY.md'), lines.join('\n'));
  for (const seed of SEEDS)
    fs.writeFileSync(
      path.join(RESULTS, `${seed}.json`),
      JSON.stringify(perSeed[seed], null, 2),
    );
  fs.writeFileSync(
    path.join(RESULTS, 'references.json'),
    JSON.stringify({ references, oracle: oracleResults }, null, 2),
  );
  console.log(lines.join('\n'));
  const failed =
    SEEDS.some((seed) =>
      Object.values(perSeed[seed]).some((r) => r.status === 'fail'),
    ) ||
    references.some((r) => r.status === 'fail') ||
    oracleResults.some((r) => r.status === 'fail');
  if (failed && strict) process.exit(1);
};

main();

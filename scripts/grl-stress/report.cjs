/**
 * SUMMARY.md: one row per seed and strategy (a seed without strategies, one
 * row), and what each check says.
 */
const { RUNS } = require('./compare.cjs');

const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };

/** A table cell: no pipes or line breaks. */
const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const describe = (check) => {
  if (!check) return '';
  if (check.status === 'skip') return `${ICON.skip} ${check.reason}`;
  if (check.error) return `${ICON.fail} ${check.error}`;
  return ICON[check.status];
};

const importCell = (check) =>
  check.status === 'fail' && check.errors
    ? `${ICON.fail} ${check.errors.length} error(s): ${check.errors[0]}`
    : describe(check);

const conformanceCell = (check) =>
  check.expected
    ? `${ICON[check.status]} elements ${check.imported.elements}/${check.expected.elements}, links ${check.imported.links}/${check.expected.links}`
    : describe(check);

const checksCell = (check) =>
  check.status === 'pass'
    ? `${ICON.pass} ${check.links} contribution(s)`
    : check.failures
      ? `${ICON.fail} ${check.failures.length}: ${check.failures[0].check} on ${check.failures[0].link}`
      : describe(check);

const runCell = (run) =>
  run.rows !== undefined
    ? `${ICON[run.status]} ${run.equal}/${run.rows}`
    : describe(run);

/** the round trip, then jUCMNav on the written file (native.cjs) */
const nativeCell = (check) =>
  check?.roundTrip
    ? `${describe(check.roundTrip)} round trip; ${
        check.oracle.rows !== undefined
          ? `${ICON[check.oracle.status]} jUCMNav ${check.oracle.equal}/${check.oracle.rows}`
          : `jUCMNav ${describe(check.oracle)}`
      }`
    : describe(check);

const HEADERS = [
  'Seed',
  'Strategy',
  'Imported',
  'Conformance',
  'Checks',
  'Native',
  ...RUNS.map((run) =>
    run.algorithm === 'quantitative'
      ? `Quantitative (tolerance ${run.tolerance})`
      : 'Qualitative',
  ),
];

const rowsOf = (result) => {
  const { checks } = result;
  if (result.missing)
    return [[result.seed, '', `${ICON.skip} ${result.missing}`]];
  const common = [
    importCell(checks.import),
    conformanceCell(checks.conformance),
    checksCell(checks.checks),
    nativeCell(checks.native),
  ];
  const seed = result.committed ? `**${result.seed}**` : result.seed;
  if (!result.strategies.length)
    return [
      [seed, '—', ...common, ...RUNS.map(() => describe(checks.evaluations))],
    ];
  return result.strategies.map((strategy) => [
    seed,
    `${strategy.name} (${strategy.id})`,
    ...common,
    ...RUNS.map((run) => runCell(strategy.runs[run.key])),
  ]);
};

/** The first differences of each failing evaluation, for the reader. */
const differences = (results) => {
  const lines = [];
  for (const result of results)
    for (const strategy of result.strategies ?? [])
      for (const run of RUNS) {
        const { differences: diffs } = strategy.runs[run.key];
        if (!diffs) continue;
        lines.push(`- **${result.seed}** ${strategy.name}, ${run.key}:`);
        for (const d of diffs.slice(0, 5))
          lines.push(
            `  - ${d.kind} ${d.id}: jUCMNav ${d.jucmnav.value} ${d.jucmnav.label || '(no label)'}, ours ${d.ours ? `${d.ours.value} ${d.ours.label || '(no label)'}` : 'none'}`,
          );
      }
  for (const result of results) {
    const oracle = result.checks?.native?.oracle;
    const rows = [...(oracle?.differences ?? []), ...(oracle?.extra ?? [])];
    if (!rows.length) continue;
    lines.push(`- **${result.seed}**, jUCMNav on the written file:`);
    for (const row of rows.slice(0, 5)) lines.push(`  - ${row}`);
  }
  return lines;
};

const markdown = (summary) => {
  const { results } = summary;
  const count = (status) =>
    results.filter(
      (r) =>
        !r.missing && Object.values(r.checks).some((c) => c.status === status),
    ).length;
  const lines = [
    '# GRL stress test (goal-controller#106)',
    '',
    `Generated ${summary.generatedAt}. Sources: ${summary.sources.join(', ')}.`,
    `Committed seeds are in **bold**; with \`--strict\`, a failure of one fails the run.`,
    '',
    `${results.length} seeds: ${count('fail')} with a failing check. Exit code ${summary.exitCode}.`,
    '',
    `| ${HEADERS.join(' | ')} |`,
    `| ${HEADERS.map(() => '---').join(' | ')} |`,
    ...results.flatMap(rowsOf).map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  const diffs = differences(results);
  if (diffs.length) lines.push('', '## Differences', '', ...diffs);
  return `${lines.join('\n')}\n`;
};

module.exports = { markdown };

/** The stress test's Markdown summary, from its results. */

const CHECKS = [
  ['parses', 'Parses'],
  ['roundTrip', 'Round-trip'],
  ['dialectChecks', 'Dialect checks'],
  ['generates', 'Generates'],
  ['mdp', 'MDP'],
  ['pctl', 'PCTL'],
  ['reliability', 'Reliability'],
  ['cost', 'Cost'],
  ['performance', 'Time / size'],
  ['build', 'Builds'],
];

const MARK = {
  pass: '✅',
  fail: '❌',
  'expected-fail': '⚠️',
  skipped: '⏭️',
  unavailable: '—',
};

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const cell = (check) => {
  if (!check) return '';
  const mark = MARK[check.status] ?? check.status;
  if (check.milliseconds)
    return `${check.milliseconds.median.toFixed(1)} ms · ${kb(check.bytes.ours)}`;
  if (check.status === 'pass' && check.states !== undefined)
    return `${mark} ${check.states} st / ${check.transitions} tr`;
  return mark;
};

/** A line per divergence: the check, and what differed. */
const divergences = (result) =>
  Object.entries(result.checks).flatMap(([name, check]) => {
    if (check.status !== 'fail' && check.status !== 'expected-fail') return [];
    const what =
      check.error ??
      (name === 'mdp'
        ? `line ${check.firstDifference?.line}: ours \`${check.firstDifference?.ours}\`, reference \`${check.firstDifference?.reference}\` (${check.onlyOurs?.count} lines only ours, ${check.onlyReference?.count} only the reference)`
        : name === 'pctl'
          ? Object.entries(check.files)
              .filter(([, file]) => !file.equal)
              .map(([file]) => file)
              .join(', ')
          : name === 'reliability' || name === 'cost'
            ? `${check.mismatches?.count ?? 0} of ${check.points} points differ; variables only ours: ${check.variables?.onlyOurs.join(', ') || 'none'}, only the reference: ${check.variables?.onlyReference.join(', ') || 'none'}`
            : name === 'parses'
              ? check.errors.map((e) => e.message).join('; ')
              : name === 'roundTrip'
                ? `${check.edits.length} edits, not listed: ${check.notListed.join(', ') || 'none'}`
                : name === 'dialectChecks'
                  ? `got ${JSON.stringify(check.got)}, expected ${JSON.stringify(check.expected)}`
                  : JSON.stringify(check).slice(0, 200));
    return [`- **${result.model}** · ${name}: ${what}`];
  });

/** Notes that aren't failures: a reference's own gaps, skipped checks. */
const notes = (result) =>
  Object.entries(result.checks).flatMap(([name, check]) =>
    check.evalPoint?.missing
      ? [
          `- **${result.model}** · ${name}: the reference's eval_formula.sh gives no value for ${check.evalPoint.missing.join(', ')}; that point was left out (the random points still compare).`,
        ]
      : [],
  );

const markdown = ({
  commit,
  engine,
  results,
  regressions,
  exitCode,
  generatedAt,
}) => {
  const header = `| Model (issue, generator) | ${CHECKS.map(([, title]) => title).join(' | ')} |`;
  const rule = `|---|${CHECKS.map(() => '---').join('|')}|`;
  const rows = results.map(
    (result) =>
      `| ${result.model} (${result.issue}, ${result.variant}) | ${CHECKS.map(([key]) => cell(result.checks[key])).join(' | ')} |`,
  );
  const failures = results.flatMap(divergences);
  const remarks = results.flatMap(notes);
  return [
    '# GODA-MDP stress test',
    '',
    `pistarGODA-MDP at \`${commit}\` · engine: ${engine ? 'GODA (lib)' : 'not in the built lib (#32): its checks are unavailable'} · ${generatedAt}`,
    '',
    header,
    rule,
    ...rows,
    '',
    `${MARK.pass} pass · ${MARK.fail} fail · ${MARK['expected-fail']} fails on a model its issue hasn't brought up yet (expected) · ${MARK.skipped} skipped (a tool not on PATH) · ${MARK.unavailable} unavailable`,
    '',
    `**Regressions in the other engines** (language snapshot against the baseline): ${regressions.status}${regressions.changed ? ` (${regressions.files} files; ${regressions.changed.length} changed, ${regressions.added.length} added, ${regressions.removed.length} removed)` : regressions.reason ? `: ${regressions.reason}` : ''}`,
    '',
    '## Divergences',
    '',
    ...(failures.length ? failures : ['None.']),
    '',
    ...(remarks.length ? ['## Notes', '', ...remarks, ''] : []),
    `Exit code ${exitCode}.`,
    '',
  ].join('\n');
};

module.exports = { CHECKS, markdown };

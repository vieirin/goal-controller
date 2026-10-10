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
  ['evalScript', 'eval_formula.sh'],
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

/**
 * What upstream's generator does that the engine reproduces or the harness
 * allows for, not a divergence (#38's design note; #34 D15). Line numbers
 * are at 5305bc1: PP = PARAMProducer.java, PW = PrismWriter.java.
 */
const KNOWN_UPSTREAM = [
  "**eval_formula.sh's order.** Its parameters and `sed` options come in Java HashMap order (PP:144). It is compared as a set of lines and `sed` options, not byte for byte (D15).",
  "**Formula comments' order.** The `//CTX_…`, `//R_…` and `//W_…` lines of reliability.out and cost.out are in HashMap order too (PP:179). Comments are dropped before the numeric comparison.",
  "**BSN's eval_formula.sh lacks values.** It has none for `R_G3_T1_X`, because the optional node's `OPT_` entry replaces its `R_` entry (PP:246, PP:249). It has none for `R_G3_T1_3` or `R_G3_T1_4`, because the `* R_<node>` that the AND cost puts on non-leaf tasks (PP:294) is never declared. That evaluation point is left out, and the random points compare.",
  "**Module order in the July 2019 references** (TAS, BSN, Fragmented). It follows the producer's traversal, since `Collections.sort` is commented out (PW:164). The MDP diff is order-sensitive and says `reordered` when only the order differs.",
  '**An OR with three or more children** makes a malformed formula: `currentFormula` is appended twice with no operator (PP:359, PP:365). None of the seven references has one.',
  "**Fragmented's 4092 `const int CTX_n` constants** are the power set of its decision-making contexts. Both generator versions make them (`writeNondeterministicModule`). This is a size and speed concern for #39, not a variant difference.",
  "**Not variant behaviour, but framework items of #32:** BSN's repeated ids under G3 and G4 (item 4), TAS's Resources without ids (item 9), and Fragmented's spaces in brackets and dangling decision-making operands (items 5 and 1).",
];

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
            : name === 'evalScript'
              ? `${check.onlyOurs?.count} parts only ours, ${check.onlyReference?.count} only the reference (compared as a set: upstream builds it from a HashMap)`
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
    '## Known upstream behaviour',
    '',
    ...KNOWN_UPSTREAM.map((line) => `- ${line}`),
    '',
    `Exit code ${exitCode}.`,
    '',
  ].join('\n');
};

module.exports = { CHECKS, KNOWN_UPSTREAM, markdown };

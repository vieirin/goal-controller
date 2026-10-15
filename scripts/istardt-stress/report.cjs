/**
 * SUMMARY.md: one row per seed, what each check says, and the oracle's
 * utilities (ours, the golden's, dtg2sim's trials for information).
 */
const ICON = { pass: '✅', fail: '❌', skip: '⏭️' };

/** A table cell: no pipes or line breaks. */
const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const describe = (check) => {
  if (!check) return '';
  if (check.status === 'skip') return `${ICON.skip} ${check.reason}`;
  if (check.error) return `${ICON.fail} ${check.error}`;
  if (check.errors)
    return `${ICON.fail} ${check.errors.length}: ${check.errors[0]}`;
  return ICON[check.status];
};

const importCell = (check) =>
  check.status === 'pass' && check.warnings
    ? `${ICON.pass} (${check.warnings} warning(s))`
    : describe(check);

const checksCell = (check) =>
  check?.status === 'pass' && (check.warnings || check.infos)
    ? `${ICON.pass} (${[check.warnings && `${check.warnings} warning(s)`, check.infos && `${check.infos} info`].filter(Boolean).join(', ')})`
    : describe(check);

const dtgologCell = (check) =>
  check?.difference
    ? `${ICON.fail} line ${check.difference.line}: \`${check.difference.ours}\` ≠ \`${check.difference.golden}\``
    : check?.status === 'pass'
      ? `${ICON.pass} ${check.lines} lines`
      : describe(check);

const oracleCell = (check) =>
  check?.utility !== undefined
    ? `${ICON[check.status]} U = ${check.utility}, P = ${check.probability}${check.status === 'fail' ? ` (reference U = ${check.reference.utility}, P = ${check.reference.probability})` : ''}`
    : describe(check);

const trialsCell = (trials, oracle) =>
  trials
    ? `${trials.utility}${oracle?.utility !== undefined ? (oracle.utility === trials.utility ? ' (same)' : ' (differs)') : ''} (${trials.from})`
    : '';

const HEADERS = [
  'Seed',
  'Imported',
  'Model',
  'Checks',
  'DT-Golog (byte-exact after the header)',
  'Oracle: utility and policy',
  'dtg2sim trials (informational)',
];

const markdown = ({ sources, generatedAt, exitCode, oracle, results }) => {
  const rows = results.map((result) => {
    const name = result.committed ? `**${result.seed}**` : result.seed;
    if (result.missing)
      return [name, `${ICON.skip} ${result.missing}`, '', '', '', '', ''];
    const { checks } = result;
    return [
      name,
      importCell(checks.import),
      result.committed ? describe(checks.model) : '',
      checksCell(checks.checks),
      dtgologCell(checks.dtgolog),
      oracleCell(checks.oracle),
      trialsCell(result.trials, checks.oracle),
    ];
  });
  return [
    '# iStar-DT stress test',
    '',
    `Sources: ${sources.join(', ')}. Generated ${generatedAt}. Oracle: ${oracle ? 'DT-Golog (docker/dtgolog)' : 'not run (--oracle)'}. Exit code ${exitCode}.`,
    '',
    'Committed seeds in **bold** (examples/istardt/). The DT-Golog column compares the writer’s file with dtx2dtg’s golden `*-Auth.pl` after its four header lines; the oracle runs both with DT-Golog (`bp(root, 10, …)`) and compares the expected utility, the probability of success and the policy.',
    '',
    `| ${HEADERS.join(' | ')} |`,
    `| ${HEADERS.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ].join('\n');
};

module.exports = { markdown };

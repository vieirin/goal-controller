#!/usr/bin/env node
/**
 * Downloads the iStar-DT stress test's upstream files (goal-controller#119)
 * at pinned commits into a gitignored cache, `.cache/istardt/<commit>/<path>`
 * at the repository root. Single raw files, no clones:
 *
 * - cmg-york/istardt (`dtx2dtg`): the nine golden pairs under
 *   `src/test/resources/dtx2dtg/` (`*.istardtx` and its `*-Auth.pl`), the
 *   example models under `src/main/resources/xml/`, the BNF and the XSD, and
 *   the translator's sources (what the writer follows);
 * - cmg-york/mx2dtx: the `.drawio` diagrams of the same models (a `.drawio`
 *   importer's pending fixtures).
 *
 * Both are LGPL-2.1; they are fetched rather than committed so the test runs
 * against upstream as pinned (the seeds commit two of them with
 * attribution).
 *
 *   node scripts/istardt-stress/fetch.cjs          # skips files already cached
 *   node scripts/istardt-stress/fetch.cjs --force  # downloads them again
 *
 * Needs network access the first time only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, '.cache', 'istardt');

/** The nine golden pairs, in dtx2dtg's own numbering. */
const FIXTURES = [
  '1.Order',
  '2.1.Build_1R_Discrete',
  '2.2.Build_3R_Discrete',
  '2.3.Build_3R_Discrete_2',
  '2.4.Build_1R_Mixed',
  '2.5.Build_5R_Mixed',
  '3.1.Heating_1R_Mixed',
  '3.2.Heating_10R_Mixed',
  '4.1.OrganizeTravel',
];

const ISTARDT = {
  repo: 'cmg-york/istardt',
  commit: '649c9be2a0a45ee42d2056d9fed68016ac4f3689',
  files: [
    ...FIXTURES.flatMap((name) => [
      `src/test/resources/dtx2dtg/${name}.istardtx`,
      `src/test/resources/dtx2dtg/${name}-Auth.pl`,
    ]),
    ...[
      'Order',
      'Order-3RunDiscrete',
      'Order-5RunContinuous',
      'Build',
      'Build-5RunContinuous',
      'Heating',
      'OrganizeTravel',
    ].map((name) => `src/main/resources/xml/${name}.istardt`),
    'docs/bnf_grammar.md',
    'src/main/resources/xsd/istar_dt_x_schema.xsd',
    'src/main/java/ca/yorku/cmg/istardt/translators/dtx2dtg/dtx2dtg.java',
    'src/main/java/ca/yorku/cmg/istardt/translators/dtx2dtg/com2dtg.java',
    'src/main/java/ca/yorku/cmg/istardt/translators/dtx2dtg/FormulaParser.java',
    'src/main/java/ca/yorku/cmg/istardt/translators/dtx2dtg/Formatter.java',
    'src/main/java/ca/yorku/cmg/istardt/translators/dtx2dtg/PermutationsGenerator.java',
    'src/test/java/ca/yorku/cmg/istardt/translators/dtx2dtg/End2EndTest.java',
    // The xmlparser the translator reads with: element order, number
    // formatting and the formula trees come from here.
    ...[
      ...[
        'Actor',
        'Atom',
        'Condition',
        'DecompositionElement',
        'Effect',
        'Element',
        'Goal',
        'Model',
        'NumericConstant',
        'OperatorDecorator',
        'Quality',
        'Task',
      ].map((name) => `objects/${name}`),
      ...[
        'ActorDeserializer',
        'BaseDeserializer',
        'ConditionDeserializer',
        'EffectDeserializer',
        'FormulaDeserializer',
        'GoalDeserializer',
        'ModelDeserializer',
        'QualityDeserializer',
        'TaskDeserializer',
        'VariableDeserializer',
      ].map((name) => `xml/deserializers/${name}`),
      'xml/ReferenceResolver',
      'xml/formula/FormulaNodeVisitorImpl',
      'xml/processing/ReferenceProcessor',
      'xml/utils/DeserializerUtils',
    ].map(
      (name) => `src/main/java/ca/yorku/cmg/istardt/xmlparser/${name}.java`,
    ),
    'LICENSE',
  ],
};

const MX2DTX = {
  repo: 'cmg-york/mx2dtx',
  commit: '97b8a18e93c95bcc0330e5ee158d2f8c861129ed',
  files: FIXTURES.filter((name) => name !== '4.1.OrganizeTravel').map(
    (name) => `src/test/resources/${name}.drawio`,
  ),
};

const SOURCES = [ISTARDT, MX2DTX];

const get = async (url) => {
  const headers = { 'User-Agent': 'goal-controller-istardt-stress' };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.text();
};

/** Where a source's file is cached. */
const cached = (source, file) => path.join(CACHE, source.commit, file);

const fetchFiles = async ({ force = false } = {}) => {
  let downloaded = 0;
  for (const source of SOURCES)
    for (const file of source.files) {
      const target = cached(source, file);
      if (!force && fs.existsSync(target)) continue;
      const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${file
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await get(url));
      downloaded += 1;
    }
  return {
    files: SOURCES.reduce((n, source) => n + source.files.length, 0),
    downloaded,
  };
};

/** The nine golden pairs, cached: `{ name, model, reference }` paths each. */
const fixtures = () =>
  FIXTURES.map((name) => ({
    name,
    model: cached(ISTARDT, `src/test/resources/dtx2dtg/${name}.istardtx`),
    reference: cached(ISTARDT, `src/test/resources/dtx2dtg/${name}-Auth.pl`),
  }));

module.exports = {
  CACHE,
  FIXTURES,
  ISTARDT,
  MX2DTX,
  cached,
  fetchFiles,
  fixtures,
};

if (require.main === module)
  fetchFiles({ force: process.argv.includes('--force') }).then(
    ({ files, downloaded }) =>
      console.log(
        `${files} files in ${path.relative(ROOT, CACHE)} (${downloaded} downloaded)`,
      ),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );

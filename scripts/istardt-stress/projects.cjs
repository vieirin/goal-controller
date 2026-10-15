/**
 * The iStar-DT seeds committed as projects under examples/istardt/
 * (goal-controller#119), and the nine fetched golden pairs: each seed's
 * source, its golden DT-Golog file (none for our own model: its reference
 * is the oracle's run), and, for a committed one, the imported model kept
 * beside it.
 *
 *   node scripts/istardt-stress/projects.cjs --write      # the committed sources, golden files and models
 *   node scripts/istardt-stress/projects.cjs --utilities  # reference/utility.txt, from the last --oracle run
 */
const fs = require('fs');
const path = require('path');
const { fixtures, ISTARDT, cached } = require('./fetch.cjs');

const ROOT = path.join(__dirname, '..', '..');
const EXAMPLES = path.join(ROOT, 'examples', 'istardt');

/** The committed seeds: a project each. */
const PROJECTS = [
  {
    id: 'istardt-order',
    source: '1.Order.istardtx',
    model: 'Order.txt',
    modelName: 'Order',
    golden: 'reference/Order.pl',
    fixture: '1.Order',
  },
  {
    id: 'istardt-heating',
    source: '3.2.Heating_10R_Mixed.istardtx',
    model: 'Heating.txt',
    modelName: 'Heating',
    golden: 'reference/Heating.pl',
    fixture: '3.2.Heating_10R_Mixed',
  },
  {
    id: 'istardt-own',
    source: 'istardt-own.istardtx',
    model: 'istardt-own.txt',
    modelName: 'Garden',
    golden: null,
    fixture: null,
  },
];

const inProject = (project, file) => path.join(EXAMPLES, project.id, file);

/** The committed seeds, as the harness reads them. */
const committedSeeds = () =>
  PROJECTS.map((project) => ({
    id: project.id,
    committed: true,
    modelName: project.modelName,
    source: inProject(project, project.source),
    golden: project.golden && inProject(project, project.golden),
    model: inProject(project, project.model),
    project: inProject(project, 'project.json'),
    utility: inProject(project, 'reference/utility.txt'),
  }));

/** The fetched golden pairs, as the harness reads them. */
const fetchedSeeds = () =>
  fixtures().map(({ name, model, reference }) => ({
    id: name,
    committed: false,
    modelName: 'Spec',
    source: model,
    golden: reference,
  }));

/** A model as the project keeps it: the importer's piStar JSON, indented. */
const modelText = (model) => `${JSON.stringify(model, null, 2)}\n`;

/**
 * Rewrites each committed project's source and golden file from the fetched
 * fixtures (theirs, LGPL-2.1), and its model from the importer.
 */
const writeProjects = (lib) => {
  for (const project of PROJECTS) {
    if (project.fixture) {
      const dir = 'src/test/resources/dtx2dtg';
      fs.copyFileSync(
        cached(ISTARDT, `${dir}/${project.fixture}.istardtx`),
        inProject(project, project.source),
      );
      fs.mkdirSync(path.dirname(inProject(project, project.golden)), {
        recursive: true,
      });
      fs.copyFileSync(
        cached(ISTARDT, `${dir}/${project.fixture}-Auth.pl`),
        inProject(project, project.golden),
      );
    }
    const result = lib.importIstardt(
      fs.readFileSync(inProject(project, project.source), 'utf8'),
      { modelName: project.modelName },
    );
    if (!result.model)
      throw new Error(
        `${project.id}: ${result.diagnostics.map((d) => d.message).join('; ')}`,
      );
    fs.writeFileSync(
      inProject(project, project.model),
      modelText(result.model),
    );
    console.log(`${project.id}: ${project.model}`);
  }
};

/**
 * Each committed project's `reference/utility.txt`: DT-Golog's run of our
 * program, from the last `run.cjs --oracle` (our own model's reference).
 */
const writeUtilities = () => {
  const { OUT } = require('./oracle.cjs');
  for (const project of PROJECTS) {
    const result = path.join(OUT, `${project.id}.txt`);
    if (!fs.existsSync(result))
      throw new Error(`${project.id}: no oracle result (run.cjs --oracle)`);
    fs.mkdirSync(path.dirname(inProject(project, 'reference/utility.txt')), {
      recursive: true,
    });
    fs.copyFileSync(result, inProject(project, 'reference/utility.txt'));
    console.log(`${project.id}: reference/utility.txt`);
  }
};

module.exports = {
  EXAMPLES,
  PROJECTS,
  committedSeeds,
  fetchedSeeds,
  modelText,
  writeProjects,
  writeUtilities,
};

if (require.main === module) {
  if (process.argv.includes('--write'))
    writeProjects(require(path.join(ROOT, 'packages/lib/out/index.js')));
  if (process.argv.includes('--utilities')) writeUtilities();
}

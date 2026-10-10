/**
 * pistarGODA-MDP's seven examples as the stress test reads them: each model
 * and its reference outputs (the MDP, the four PCTL files, both formulas and
 * the values eval_formula.sh gives the parameters).
 */
const fs = require('fs');
const path = require('path');
const { evalFormulaValues } = require('./compare.cjs');

/**
 * The generator versions the references were made with (#34 D10): upstream
 * `cc808b6` (2019-01, a frequency parameter `F_` per task) and `5305bc1`
 * (2019-07, without it). The engine is run with the model's.
 */
const VARIANTS = { january2019: 'cc808b6', july2019: '5305bc1' };

/**
 * The models, in the order of #32's table, with the issue that brings each
 * one up (until it lands, its failures are expected, not regressions) and
 * the generator version of its reference.
 */
const MODELS = [
  {
    name: 'AND',
    folder: 'AND',
    model: 'and2.txt',
    issue: '#32',
    variant: VARIANTS.january2019,
  },
  {
    name: 'OR',
    folder: 'OR',
    model: 'or2.txt',
    issue: '#32',
    variant: VARIANTS.january2019,
  },
  {
    name: 'DM',
    folder: 'DM',
    model: 'dm2.txt',
    issue: '#36',
    variant: VARIANTS.january2019,
  },
  {
    name: 'Incompleteness',
    folder: 'Incompleteness',
    model: 'incompleteness.txt',
    issue: '#37',
    variant: VARIANTS.january2019,
  },
  {
    name: 'TAS',
    folder: 'TAS',
    model: 'TAS.txt',
    issue: '#38',
    variant: VARIANTS.july2019,
  },
  {
    name: 'Fragmented',
    folder: 'Alternative Modeling',
    model: 'Fragmented.txt',
    issue: '#39',
    variant: VARIANTS.july2019,
  },
  {
    name: 'BSN',
    folder: 'BSN',
    model: 'BSN.txt',
    issue: '#40',
    variant: VARIANTS.july2019,
  },
];

const PCTL = [
  'ReachabilityMax.pctl',
  'ReachabilityMin.pctl',
  'CostMax.pctl',
  'CostMin.pctl',
];

/** A model's files: its text and its reference outputs, by role. */
const loadReference = (examples, { name, folder, model, issue, variant }) => {
  const dir = path.join(examples, folder);
  const outputDir = path.join(dir, 'output');
  const read = (file) => fs.readFileSync(path.join(outputDir, file), 'utf8');
  const files = fs.readdirSync(outputDir);
  const mdp = files.find((file) => file.endsWith('.nm'));
  if (!mdp) throw new Error(`${folder}: no .nm in output/`);
  const evalScript = read('eval_formula.sh');
  return {
    name,
    issue,
    variant,
    modelFile: path.join(dir, model),
    modelName: model,
    text: fs.readFileSync(path.join(dir, model), 'utf8'),
    reference: {
      mdp: { fileName: mdp, text: read(mdp) },
      pctl: Object.fromEntries(PCTL.map((file) => [file, read(file)])),
      reliability: read('reliability.out'),
      cost: read('cost.out'),
      evalScript,
      evalValues: evalFormulaValues(evalScript),
      size: files.reduce(
        (sum, file) => sum + fs.statSync(path.join(outputDir, file)).size,
        0,
      ),
    },
  };
};

/** Every model's reference; throws when the cache lacks one (run fetch.cjs). */
const loadReferences = (examples) =>
  MODELS.map((model) => loadReference(examples, model));

/**
 * An engine output's files by role, matched by name as upstream writes
 * them: the `.nm` file, the four PCTL files, reliability.out, cost.out and
 * eval_formula.sh.
 */
const outputRoles = (files) => {
  const byName = (name) => files.find((file) => file.fileName === name);
  return {
    mdp: files.find((file) => file.fileName.endsWith('.nm')),
    pctl: Object.fromEntries(PCTL.map((name) => [name, byName(name)])),
    reliability: byName('reliability.out'),
    cost: byName('cost.out'),
    evaluate: byName('eval_formula.sh'),
  };
};

module.exports = {
  MODELS,
  PCTL,
  VARIANTS,
  loadReference,
  loadReferences,
  outputRoles,
};

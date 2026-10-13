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

/**
 * SA-BSN (lesunb/bsn, #93): a model the BSN runtime consumes. Its variant
 * is `cc808b6` (#93 D2); it also runs with the other, a result each, so the
 * report says which variant reproduces which of `param.zip`'s files. What
 * isn't its variant's to pass is informational (`informational`): reported,
 * never a failure. What the runtime loads is the `runtime` pair, read by
 * components: the leaves' scoped ids, with dots as underscores.
 */
const SA_BSN_MODEL = {
  name: 'SA-BSN',
  model: 'goalModel.txt',
  issue: '#94',
  variant: VARIANTS.january2019,
  variants: [VARIANTS.january2019, VARIANTS.july2019],
  options: { runtimeFormulas: true },
  informational: (variant) =>
    variant === SA_BSN_MODEL.variant
      ? {
          // param.zip comes from an earlier revision of the model (#98)
          checks: ['mdp', 'pctl', 'reliability', 'cost', 'evalScript'],
          reason:
            'param.zip was generated from an earlier revision of the model',
        }
      : {
          checks: 'all',
          reason: `not SA-BSN's variant (${SA_BSN_MODEL.variant}, #93 D2): upstream ${variant} throws on this model too`,
        },
  components: [
    'G3_T1_1',
    'G3_T1_2',
    'G3_T1_3',
    'G3_T1_4',
    'G3_T1_5',
    'G3_T1_6',
    'G4_T1',
  ],
  // evaluation parity's third value set: the `Unknown_sensor` leaf off
  deactivated: 'G3_T1_5',
};

/** A GODA output set's files by role, as upstream writes them into a folder. */
const readOutputs = (outputDir) => {
  const read = (file) => fs.readFileSync(path.join(outputDir, file), 'utf8');
  const files = fs.readdirSync(outputDir);
  const mdp = files.find((file) => file.endsWith('.nm'));
  if (!mdp) throw new Error(`${outputDir}: no .nm`);
  const evalScript = read('eval_formula.sh');
  return {
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
  };
};

/** A model's files: its text and its reference outputs, by role. */
const loadReference = (examples, { name, folder, model, issue, variant }) => {
  const dir = path.join(examples, folder);
  return {
    name,
    issue,
    variant,
    modelFile: path.join(dir, model),
    modelName: model,
    text: fs.readFileSync(path.join(dir, model), 'utf8'),
    reference: readOutputs(path.join(dir, 'output')),
  };
};

/**
 * SA-BSN's reference, once per variant: param.zip's files (unzipped into
 * `param/`) and the runtime pair, upstream's `reliability.formula` and
 * `cost.formula`.
 */
const loadSaBsnReferences = (directory) => {
  const { name, model, issue, informational, ...rest } = SA_BSN_MODEL;
  const read = (file) => fs.readFileSync(path.join(directory, file), 'utf8');
  const reference = {
    ...readOutputs(path.join(directory, 'param')),
    runtime: {
      reliability: read('reliability.formula'),
      cost: read('cost.formula'),
    },
  };
  return rest.variants.map((variant) => ({
    name,
    issue,
    ...rest,
    variant,
    informational: informational(variant),
    modelFile: path.join(directory, model),
    modelName: model,
    text: read(model),
    reference,
  }));
};

/**
 * Every model's reference (SA-BSN's once per variant); throws when the
 * cache lacks one (run fetch.cjs).
 */
const loadReferences = (examples, saBsn) => [
  ...MODELS.map((model) => loadReference(examples, model)),
  ...loadSaBsnReferences(saBsn),
];

/**
 * An engine output's files by role, matched by name as upstream writes
 * them: the `.nm` file, the four PCTL files, reliability.out, cost.out and
 * eval_formula.sh; and the runtime pair, reliability.formula and
 * cost.formula (SA-BSN, #94).
 */
const outputRoles = (files) => {
  const byName = (name) => files.find((file) => file.fileName === name);
  return {
    mdp: files.find((file) => file.fileName.endsWith('.nm')),
    pctl: Object.fromEntries(PCTL.map((name) => [name, byName(name)])),
    reliability: byName('reliability.out'),
    cost: byName('cost.out'),
    evaluate: byName('eval_formula.sh'),
    runtime: {
      reliability: byName('reliability.formula'),
      cost: byName('cost.formula'),
    },
  };
};

module.exports = {
  MODELS,
  PCTL,
  SA_BSN_MODEL,
  VARIANTS,
  loadReference,
  loadReferences,
  loadSaBsnReferences,
  outputRoles,
  readOutputs,
};

/**
 * The GODA stress test's harness (scripts/goda-stress, goal-controller#35),
 * on small hand-written fixtures: the upstream models are fetched, not
 * committed (#34 D1), so these tests need no network. The formula evaluator
 * is lib's, tested with the engine (engines/goda).
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { GoalTree, Model, goalView } from '@goal-controller/goal-tree';
import { edgeV2 } from '../../src';

/* eslint-disable @typescript-eslint/no-require-imports */
const compare = require('../../../../scripts/goda-stress/compare.cjs');
const { checkModel } = require('../../../../scripts/goda-stress/checks.cjs');
const { godaEngine } = require('../../../../scripts/goda-stress/engine.cjs');
const {
  outputRoles,
} = require('../../../../scripts/goda-stress/references.cjs');
const {
  undefinedConstants,
} = require('../../../../scripts/goda-stress/build.cjs');
const { markdown } = require('../../../../scripts/goda-stress/report.cjs');
/* eslint-enable @typescript-eslint/no-require-imports */

const MDP = `mdp

const double R_G1_T1;

module G1_T1_Task
\tsG1_T1 :[0..2] init 0;
\t[] sG1_T1 =  0 -> R_G1_T1 : (sG1_T1'=1) + (1 - R_G1_T1) : (sG1_T1'=2);
endmodule

label "success" = (sG1_T1=1);
`;
const RELIABILITY = '(F_A*R_A*F_B*R_B)\n\n//R_A = reliability of node A\n';
const OR = '(-F_A*R_A*F_B*R_B+F_A*R_A+F_B*R_B)';
const EVAL = `#!/bin/bash
W_A="1";
R_A="0.99";

sed   -e "s/W_A/$W_A/g" -e "s/R_A/$R_A/g" $1 |  gawk '{print "scale=20;"$0}' | bc
exit 0;
`;

describe('GODA stress test: comparisons', () => {
  it('compares MDPs after whitespace normalization, and says where they part', () => {
    const spaced = MDP.replace(/\t/g, '    ').replace(/ = /g, '   =  ');
    assert.strictEqual(compare.diffMdp(spaced, `\n${MDP}\n\n`).equal, true);
    const changed = compare.diffMdp(MDP.replace('init 0', 'init 1'), MDP);
    assert.strictEqual(changed.equal, false);
    assert.deepStrictEqual(changed.firstDifference, {
      line: 4,
      ours: 'sG1_T1 :[0..2] init 1;',
      reference: 'sG1_T1 :[0..2] init 0;',
    });
    assert.strictEqual(changed.onlyOurs.count, 1);
    // the same lines in another order
    const lines = MDP.split('\n');
    const swapped = [lines[2], lines[0], lines[1], ...lines.slice(3)].join(
      '\n',
    );
    assert.strictEqual(compare.diffMdp(swapped, MDP).reordered, true);
  });

  it('compares PCTL files byte for byte', () => {
    const pctl = 'Pmax=? [ F "success" ]\n';
    assert.strictEqual(compare.compareBytes(pctl, pctl).equal, true);
    const spaced = compare.compareBytes('Pmax=? [ F "success" ] \n', pctl);
    assert.strictEqual(spaced.equal, false);
    assert.strictEqual(spaced.firstDifference, 22);
  });

  it('compares eval_formula.sh as a set of lines and sed options (#34 D15)', () => {
    // upstream's HashMap order: the parameters and the -e options in another order
    const reordered = EVAL.replace(
      'W_A="1";\nR_A="0.99";',
      'R_A="0.99";\nW_A="1";',
    ).replace(
      '-e "s/W_A/$W_A/g" -e "s/R_A/$R_A/g"',
      '-e "s/R_A/$R_A/g"  -e "s/W_A/$W_A/g"',
    );
    assert.notStrictEqual(reordered, EVAL);
    assert.strictEqual(compare.compareLineSets(reordered, EVAL).equal, true);
    const changed = compare.compareLineSets(EVAL.replace('0.99', '0.9'), EVAL);
    assert.strictEqual(changed.equal, false);
    assert.deepStrictEqual(changed.onlyOurs.sample, ['R_A="0.9";']);
    // a missing option is a difference, not only a missing line
    const dropped = compare.compareLineSets(
      EVAL.replace(' -e "s/R_A/$R_A/g"', ''),
      EVAL,
    );
    assert.deepStrictEqual(dropped.onlyReference.sample, [
      'sed-option:-e "s/R_A/$R_A/g"',
    ]);
  });

  it("reads an MDP's undefined constants (the build check's -const)", () => {
    assert.deepStrictEqual(undefinedConstants(MDP), ['R_G1_T1']);
  });
});

describe('GODA stress test: checks on a model', () => {
  const MODEL = '../../examples/edgeV2/simpleChoice.txt';
  const text = readFileSync(MODEL, 'utf8');
  const deps = {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    core: require('../../../goal-tree/node_modules/@istar-ts/core'),
    goalTree: { goalView, Model, GoalTree },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    language: require('@goal-controller/goal-language'),
  };
  const reference = {
    name: 'AND',
    issue: '#32',
    variant: 'cc808b6',
    modelName: 'simpleChoice.txt',
    text,
    reference: {
      mdp: { fileName: 'AND.nm', text: MDP },
      pctl: {
        'ReachabilityMax.pctl': 'Pmax=? [ F "success" ]\n',
        'ReachabilityMin.pctl': 'Pmin=? [ F "success" ]\n',
        'CostMax.pctl': 'R{"cost"}max=? [ F "success" ]\n',
        'CostMin.pctl': 'R{"cost"}min=? [ F "success" ]\n',
      },
      reliability: RELIABILITY,
      cost: OR,
      evalScript: EVAL,
      evalValues: { F_A: 0.99, R_A: 0.99, F_B: 0.99, R_B: 0.99 },
      size: 1,
    },
  };
  /** A stand-in engine that writes the reference's files (edgeV2's dialect reads the model). */
  const echo = (
    change: (name: string, text: string) => string = (_, t) => t,
  ) => ({
    definition: edgeV2,
    checks: {},
    implements: (variant: string) => variant === 'cc808b6',
    output: () => ({
      files: [
        {
          id: 'model',
          fileName: 'Model.nm',
          text: change('nm', MDP),
          primary: true,
        },
        ...Object.entries(reference.reference.pctl).map(([fileName, t]) => ({
          id: fileName,
          fileName,
          text: change(fileName, t),
        })),
        {
          id: 'reliability',
          fileName: 'reliability.out',
          text: change('reliability', RELIABILITY),
        },
        { id: 'cost', fileName: 'cost.out', text: change('cost', OR) },
        {
          id: 'evaluate',
          fileName: 'eval_formula.sh',
          text: change('evaluate', EVAL),
        },
      ],
    }),
  });
  const statuses = (checks: Record<string, { status: string }>) =>
    Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.status]));

  it('without the engine, every check is unavailable (no adapter over a lib without godaOutput)', () => {
    assert.strictEqual(godaEngine({}), null);
    const checks = checkModel(deps, null, reference);
    assert.ok(
      Object.values(checks).every((c: any) => c.status === 'unavailable'),
    );
  });

  it("passes every engine check when the engine writes the reference's files", () => {
    const checks = checkModel(deps, echo(), reference, {
      runs: 1,
      build: false,
    });
    assert.deepStrictEqual(statuses(checks), {
      parses: 'pass',
      roundTrip: 'pass',
      dialectChecks: 'pass',
      generates: 'pass',
      mdp: 'pass',
      pctl: 'pass',
      reliability: 'pass',
      cost: 'pass',
      evalScript: 'pass',
      performance: 'pass',
      build: 'skipped',
    });
    assert.strictEqual(checks.mdp.fileName, 'Model.nm');
  });

  it('fails the check whose file differs, and only that one', () => {
    const checks = checkModel(
      deps,
      echo((name, t) =>
        name === 'CostMin.pctl'
          ? t.replace('min', 'max')
          : name === 'cost'
            ? `${t}+F_A`
            : t,
      ),
      reference,
      { runs: 1, build: false },
    );
    assert.strictEqual(checks.mdp.status, 'pass');
    assert.strictEqual(checks.pctl.status, 'fail');
    assert.deepStrictEqual(
      Object.entries(checks.pctl.files)
        .filter(([, f]: [string, any]) => !f.equal)
        .map(([name]) => name),
      ['CostMin.pctl'],
    );
    assert.strictEqual(checks.reliability.status, 'pass');
    assert.strictEqual(checks.cost.status, 'fail');
    // the summary lists both divergences
    const summary = markdown({
      commit: 'c8519f7',
      engine: true,
      generatedAt: 'now',
      results: [{ model: 'AND', issue: '#32', checks }],
      regressions: {
        status: 'pass',
        files: 1,
        changed: [],
        added: [],
        removed: [],
      },
      exitCode: 0,
    });
    assert.match(summary, /\*\*AND\*\* · pctl: CostMin\.pctl/);
    assert.match(summary, /\*\*AND\*\* · cost: 101 of 101 points differ/);
  });

  it("doesn't run the engine on a generator version it doesn't implement", () => {
    const checks = checkModel(
      deps,
      echo(),
      { ...reference, variant: '5305bc1' },
      { runs: 1, build: false },
    );
    assert.strictEqual(checks.parses.status, 'pass');
    assert.strictEqual(checks.generates.status, 'fail');
    assert.match(checks.generates.error, /variant not implemented.*5305bc1/);
    assert.strictEqual(checks.mdp.status, 'unavailable');
    // over lib: the January 2019 variant unless lib lists its own
    const lib = { goda: {}, godaEngineMapper: {}, godaOutput: () => null };
    assert.strictEqual(godaEngine(lib).implements('cc808b6'), true);
    assert.strictEqual(godaEngine(lib).implements('5305bc1'), false);
    assert.strictEqual(
      godaEngine({
        ...lib,
        GODA_IMPLEMENTED_VARIANTS: ['cc808b6', '5305bc1'],
      }).implements('5305bc1'),
      true,
    );
  });

  it("reports what the engine says it doesn't generate yet (GodaUnsupported)", () => {
    const unsupported = Object.assign(new Error('DM is #36'), {
      name: 'GodaUnsupported',
    });
    const checks = checkModel(
      deps,
      {
        ...echo(),
        output: () => {
          throw unsupported;
        },
      },
      reference,
      { runs: 1, build: false },
    );
    assert.deepStrictEqual(checks.generates, {
      status: 'fail',
      error: 'DM is #36',
      unsupported: true,
    });
    assert.strictEqual(checks.mdp.status, 'unavailable');
  });

  it('matches output files to the reference by name', () => {
    const roles = outputRoles([
      { fileName: 'X.nm' },
      { fileName: 'cost.out' },
      { fileName: 'CostMax.pctl' },
    ]);
    assert.strictEqual(roles.mdp.fileName, 'X.nm');
    assert.strictEqual(roles.cost.fileName, 'cost.out');
    assert.strictEqual(roles.reliability, undefined);
    assert.strictEqual(roles.pctl['CostMax.pctl'].fileName, 'CostMax.pctl');
  });
});

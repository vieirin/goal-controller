/**
 * The GODA stress test's harness (scripts/goda-stress, goal-controller#35),
 * on small hand-written fixtures: the upstream models are fetched, not
 * committed (#34 D1), so these tests need no network. The formula evaluator
 * is lib's, tested with the engine (engines/goda).
 */
import * as assert from 'assert';
import { spawnSync } from 'child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { deflateRawSync } from 'zlib';
import { describe, it } from 'mocha';
import { GoalTree, Model, goalView } from '@goal-controller/goal-tree';
import { edgeV2 } from '../../src';

/* eslint-disable @typescript-eslint/no-require-imports */
const compare = require('../../../../scripts/goda-stress/compare.cjs');
const {
  checkModel,
  strictFailures,
} = require('../../../../scripts/goda-stress/checks.cjs');
const { godaEngine } = require('../../../../scripts/goda-stress/engine.cjs');
const {
  SA_BSN_MODEL,
  loadSaBsnReferences,
  outputRoles,
} = require('../../../../scripts/goda-stress/references.cjs');
const {
  constantValues,
  undefinedConstants,
} = require('../../../../scripts/goda-stress/build.cjs');
const { markdown } = require('../../../../scripts/goda-stress/report.cjs');
const runtime = require('../../../../scripts/goda-stress/runtime.cjs');
const { unzip } = require('../../../../scripts/goda-stress/zip.cjs');
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

/** Two components, upstream's shapes: Π CTX·F·R and Σ CTX·W. */
const COMPONENTS = ['A_T1', 'B_T1'];
const RUNTIME_RELIABILITY = '((CTX_A_T1*F_A_T1*R_A_T1)*CTX_B_T1*F_B_T1*R_B_T1)';
const RUNTIME_COST = '((CTX_A_T1*W_A_T1)+CTX_B_T1*W_B_T1)';
/** param.zip's reliability.out shape: an OR over the components. */
const OR_RELIABILITY =
  '(-CTX_A_T1*F_A_T1*R_A_T1*CTX_B_T1*F_B_T1*R_B_T1+CTX_A_T1*F_A_T1*R_A_T1+CTX_B_T1*F_B_T1*R_B_T1)';
const VALUES = Object.fromEntries(
  COMPONENTS.flatMap((id) => [
    [`CTX_${id}`, 1],
    [`W_${id}`, 1],
    [`R_${id}`, 0.99],
    [`F_${id}`, 0.99],
  ]),
);
const RUNTIME_MODEL = { components: COMPONENTS, deactivated: 'B_T1' };
const PAIR = { reliability: RUNTIME_RELIABILITY, cost: RUNTIME_COST };
const files = (pair: { reliability: string; cost: string }) => ({
  reliability: { text: pair.reliability },
  cost: { text: pair.cost },
});

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

  it('gives a constant the script leaves out a value of its type', () => {
    // a decision-making module's CTX_<n> is never in eval_formula.sh
    const dm =
      'mdp\n\nconst int CTX_1; //ctx = 1\nconst double R_G1_T1_1;\nconst int OPT_G1_T1_X;\nconst bool B;\n';
    assert.deepStrictEqual(
      constantValues(dm, { R_G1_T1_1: 0.99, OPT_G1_T1_X: 1 }),
      {
        constants: 'CTX_1=1,R_G1_T1_1=0.99,OPT_G1_T1_X=1,B=true',
        defaulted: ['CTX_1', 'B'],
      },
    );
    assert.deepStrictEqual(constantValues('const double W;\n', {}), {
      constants: 'W=0.5',
      defaulted: ['W'],
    });
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
    mdpName = 'AND.nm',
  ) => ({
    definition: edgeV2,
    checks: {},
    implements: (variant: string) => variant === 'cc808b6',
    output: () => ({
      files: [
        {
          id: 'model',
          fileName: mdpName,
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
    assert.strictEqual(checks.mdp.fileName, 'AND.nm');
  });

  it("fails the MDP check when the .nm isn't named as the reference's", () => {
    const checks = checkModel(deps, echo(undefined, 'Lab.nm'), reference, {
      runs: 1,
      build: false,
    });
    assert.strictEqual(checks.mdp.status, 'fail');
    assert.strictEqual(checks.mdp.equal, true);
    assert.strictEqual(checks.mdp.referenceFileName, 'AND.nm');
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
    assert.strictEqual(roles.runtime.reliability, undefined);
  });

  describe('on a model the runtime consumes (SA-BSN, #95)', () => {
    const consumed = {
      ...reference,
      name: 'SA-BSN',
      issue: '#94',
      options: { runtimeFormulas: true },
      informational: ['mdp', 'pctl', 'reliability', 'cost', 'evalScript'],
      components: COMPONENTS,
      deactivated: 'B_T1',
      reference: {
        ...reference.reference,
        evalValues: { ...reference.reference.evalValues, ...VALUES },
        runtime: { reliability: RUNTIME_RELIABILITY, cost: RUNTIME_COST },
      },
    };
    /** echo(), plus the runtime pair; it records the options it was given. */
    const withPair = (pair: { reliability: string; cost: string } | null) => {
      const seen: any[] = [];
      const engine = {
        ...echo(),
        output: (model: unknown, options: unknown) => {
          seen.push(options);
          const { files } = echo().output();
          return {
            files: pair
              ? [
                  ...files,
                  {
                    id: 'reliability-formula',
                    fileName: 'reliability.formula',
                    text: pair.reliability,
                  },
                  {
                    id: 'cost-formula',
                    fileName: 'cost.formula',
                    text: pair.cost,
                  },
                ]
              : files,
          };
        },
      };
      return { engine, seen };
    };

    it("passes the model's options to the engine, and runs the runtime checks", () => {
      const { engine, seen } = withPair({
        reliability: RUNTIME_RELIABILITY,
        cost: RUNTIME_COST,
      });
      const checks = checkModel(deps, engine, consumed, {
        runs: 1,
        build: false,
      });
      assert.deepStrictEqual(seen, [
        {
          runtimeFormulas: true,
          modelName: 'simpleChoice.txt',
          variant: 'cc808b6',
        },
      ]);
      assert.strictEqual(checks.runtimePair.status, 'pass');
      assert.strictEqual(checks.termContract.status, 'pass');
      assert.strictEqual(checks.evaluationParity.status, 'pass');
    });

    it('fails the runtime pair without it, and the other two are unavailable (#94 not landed)', () => {
      const checks = checkModel(deps, withPair(null).engine, consumed, {
        runs: 1,
        build: false,
      });
      assert.strictEqual(checks.runtimePair.status, 'fail');
      assert.match(
        checks.runtimePair.error,
        /no reliability\.formula or cost\.formula/,
      );
      assert.strictEqual(checks.termContract.status, 'unavailable');
      assert.strictEqual(checks.evaluationParity.status, 'unavailable');
      // the other checks are as for any model
      assert.strictEqual(checks.mdp.status, 'pass');
    });

    it('lists the runtime checks as unavailable when nothing was generated', () => {
      const checks = checkModel(deps, null, consumed);
      for (const name of runtime.RUNTIME_CHECKS)
        assert.strictEqual(checks[name].status, 'unavailable');
      const failed = checkModel(
        deps,
        echo(),
        { ...consumed, variant: '5305bc1' },
        { runs: 1, build: false },
      );
      assert.strictEqual(failed.runtimePair.status, 'unavailable');
    });
  });
});

describe('GODA stress test: the runtime checks (SA-BSN, #95)', () => {
  it('passes all three on a pair shaped like upstream’s', () => {
    const checks = runtime.checkRuntime(
      files(PAIR),
      { runtime: PAIR, evalValues: VALUES },
      RUNTIME_MODEL,
      { bc: false },
    );
    assert.deepStrictEqual(
      runtime.RUNTIME_CHECKS.map((name: string) => checks[name].status),
      ['pass', 'pass', 'pass'],
    );
    assert.deepStrictEqual(
      checks.evaluationParity.formulas.cost.points.map((p: any) => [
        p.point,
        p.lib,
      ]),
      [
        ['evalFormula', 2],
        ['initialStrategy', 0],
        ['deactivated B_T1', 1],
      ],
    );
  });

  it('fails the pair on a trailing newline, and only the pair', () => {
    const checks = runtime.checkRuntime(
      files({ ...PAIR, cost: `${RUNTIME_COST}\n` }),
      { runtime: PAIR, evalValues: VALUES },
      RUNTIME_MODEL,
      { bc: false },
    );
    assert.strictEqual(checks.runtimePair.status, 'fail');
    assert.strictEqual(checks.runtimePair.files.cost.firstDifference, 35);
    assert.strictEqual(checks.runtimePair.files.reliability.equal, true);
    assert.strictEqual(checks.termContract.status, 'pass');
    assert.strictEqual(checks.evaluationParity.status, 'pass');
  });

  it('reads the term contract as prefixes × components: extra and missing terms', () => {
    assert.deepStrictEqual(runtime.expectedTerms('cost', COMPONENTS), [
      'CTX_A_T1',
      'CTX_B_T1',
      'W_A_T1',
      'W_B_T1',
    ]);
    // a dotted id and a dropped leaf: the engines would find other components
    const broken = runtime.termContract(
      'reliability',
      '(CTX_A_T1*F_A_T1*R_A_T1*F_B*R_B_T1)',
      COMPONENTS,
    );
    assert.deepStrictEqual(broken, {
      equal: false,
      terms: 5,
      extra: ['F_B'],
      missing: ['CTX_B_T1', 'F_B_T1'],
    });
    // a cost formula with a reliability term
    assert.deepStrictEqual(
      runtime.termContract('cost', `${RUNTIME_COST}*R_A_T1`, COMPONENTS).extra,
      ['R_A_T1'],
    );
    assert.match(
      runtime.termContract('cost', '(CTX_A_T1*', COMPONENTS).error,
      /missing operand/,
    );
  });

  it("fails parity on param.zip's OR-shaped reliability, at the points it differs", () => {
    const checks = runtime.checkRuntime(
      files({ ...PAIR, reliability: OR_RELIABILITY }),
      { runtime: PAIR, evalValues: VALUES },
      RUNTIME_MODEL,
      { bc: false },
    );
    // the same terms: only the values tell
    assert.strictEqual(checks.termContract.status, 'pass');
    assert.strictEqual(checks.evaluationParity.status, 'fail');
    const points = checks.evaluationParity.formulas.reliability.points;
    assert.deepStrictEqual(
      points.map((p: any) => [p.point, p.equal]),
      [
        ['evalFormula', false],
        ['initialStrategy', true],
        ['deactivated B_T1', false],
      ],
    );
    // upstream's formula, evaluated alongside: the semantics' value
    assert.strictEqual(points[0].reference, points[0].semantics);
    assert.strictEqual(checks.evaluationParity.formulas.cost.equal, true);
  });

  it('gives the three value sets of #95', () => {
    const sets = runtime.valueSets(VALUES, RUNTIME_MODEL);
    assert.deepStrictEqual(Object.keys(sets), [
      'evalFormula',
      'initialStrategy',
      'deactivated B_T1',
    ]);
    assert.deepStrictEqual(sets.initialStrategy, {
      CTX_A_T1: 0,
      F_A_T1: 1,
      R_A_T1: 1,
      W_A_T1: 1,
      CTX_B_T1: 0,
      F_B_T1: 1,
      R_B_T1: 1,
      W_B_T1: 1,
    });
    assert.strictEqual(sets['deactivated B_T1'].CTX_B_T1, 0);
    assert.strictEqual(sets['deactivated B_T1'].CTX_A_T1, 1);
  });

  const bc = spawnSync('which', ['bc']).status === 0;
  (bc ? it : it.skip)(
    'agrees with bc on the same text (when bc is on PATH)',
    () => {
      assert.strictEqual(
        runtime.bcValue(RUNTIME_RELIABILITY, VALUES),
        0.99 ** 4,
      );
      const checks = runtime.checkRuntime(
        files(PAIR),
        { runtime: PAIR, evalValues: VALUES },
        RUNTIME_MODEL,
        { bc: true },
      );
      assert.strictEqual(checks.evaluationParity.status, 'pass');
      assert.strictEqual(
        checks.evaluationParity.formulas.reliability.points[0].bc,
        0.99 ** 4,
      );
    },
  );
});

/** A zip archive of stored and deflated entries, as `zip` writes them. */
const zipOf = (entries: Record<string, string>) => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  Object.entries(entries).forEach(([name, text], i) => {
    const data = Buffer.from(text);
    const method = i % 2 === 0 ? 8 : 0;
    const stored = method === 8 ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, stored);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + stored.length;
  });
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
};

describe('GODA stress test: SA-BSN references (#95)', () => {
  it("unzips param.zip's stored and deflated entries", () => {
    const archive = zipOf({
      'BSN.nm': MDP,
      'CostMax.pctl': 'R{"cost"}max=? [ F "success" ]\n',
    });
    const unzipped = unzip(archive);
    assert.deepStrictEqual(Object.keys(unzipped), ['BSN.nm', 'CostMax.pctl']);
    assert.strictEqual(unzipped['BSN.nm'].toString(), MDP);
    assert.throws(() => unzip(Buffer.from('not a zip')), /not a zip archive/);
  });

  it('loads one reference per variant, with the runtime pair and the components', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sa-bsn-'));
    try {
      mkdirSync(join(dir, 'param'));
      const param: Record<string, string> = {
        'BSN.nm': MDP,
        'ReachabilityMax.pctl': 'Pmax=? [ F "success" ]\n',
        'ReachabilityMin.pctl': 'Pmin=? [ F "success" ]\n',
        'CostMax.pctl': 'R{"cost"}max=? [ F "success" ]\n',
        'CostMin.pctl': 'R{"cost"}min=? [ F "success" ]\n',
        'reliability.out': OR_RELIABILITY,
        'cost.out': RUNTIME_COST,
        'eval_formula.sh': EVAL,
      };
      for (const [name, text] of Object.entries(param))
        writeFileSync(join(dir, 'param', name), text);
      writeFileSync(join(dir, 'goalModel.txt'), '{}');
      writeFileSync(join(dir, 'reliability.formula'), RUNTIME_RELIABILITY);
      writeFileSync(join(dir, 'cost.formula'), RUNTIME_COST);
      const references = loadSaBsnReferences(dir);
      assert.deepStrictEqual(
        references.map((r: any) => r.variant),
        ['cc808b6', '5305bc1'],
      );
      const [first] = references;
      assert.strictEqual(first.name, 'SA-BSN');
      assert.strictEqual(first.modelName, 'goalModel.txt');
      assert.deepStrictEqual(first.options, { runtimeFormulas: true });
      assert.deepStrictEqual(first.components, SA_BSN_MODEL.components);
      assert.strictEqual(first.deactivated, 'G3_T1_5');
      assert.strictEqual(first.reference.runtime.cost, RUNTIME_COST);
      assert.strictEqual(first.reference.mdp.fileName, 'BSN.nm');
      assert.strictEqual(first.reference.evalValues.R_A, 0.99);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names SA-BSN's seven components as the runtime's terms do", () => {
    assert.deepStrictEqual(SA_BSN_MODEL.components, [
      'G3_T1_1',
      'G3_T1_2',
      'G3_T1_3',
      'G3_T1_4',
      'G3_T1_5',
      'G3_T1_6',
      'G4_T1',
    ]);
  });

  it("doesn't fail --strict on a supported model's informational checks", () => {
    const supported = new Set(['SA-BSN', 'AND']);
    const result = (
      model: string,
      failing: string,
      informational?: string[],
    ) => ({
      model,
      ...(informational && { informational }),
      checks: { [failing]: { status: 'fail' }, parses: { status: 'pass' } },
    });
    const informational = SA_BSN_MODEL.informational;
    assert.deepStrictEqual(
      strictFailures(
        [
          result('SA-BSN', 'mdp', informational),
          result('SA-BSN', 'build', informational),
          result('BSN', 'mdp'),
        ],
        supported,
      ),
      [],
    );
    assert.deepStrictEqual(
      strictFailures(
        [result('SA-BSN', 'runtimePair', informational), result('AND', 'mdp')],
        supported,
      ).map((r: any) => r.model),
      ['SA-BSN', 'AND'],
    );
  });

  it('reports the runtime table, param.zip per file and variant, and informational divergences', () => {
    const passing = runtime.checkRuntime(
      files(PAIR),
      { runtime: PAIR, evalValues: VALUES },
      RUNTIME_MODEL,
      { bc: false },
    );
    const sa = (variant: string, checks: Record<string, any>) => ({
      model: 'SA-BSN',
      issue: '#94',
      variant,
      informational: SA_BSN_MODEL.informational,
      checks,
    });
    const summary = markdown({
      commit: 'c8519f7',
      saBsnCommit: 'f939d3c',
      engine: true,
      generatedAt: 'now',
      results: [
        sa('cc808b6', {
          mdp: { status: 'fail', error: 'CTX_1' },
          pctl: {
            status: 'fail',
            files: {
              'ReachabilityMax.pctl': { equal: true },
              'ReachabilityMin.pctl': { equal: true },
              'CostMax.pctl': { equal: false },
              'CostMin.pctl': { equal: true },
            },
          },
          reliability: { status: 'pass' },
          cost: { status: 'pass' },
          evalScript: { status: 'pass' },
          ...passing,
        }),
        sa('5305bc1', {
          generates: { status: 'expected-fail', error: 'no context' },
          mdp: { status: 'unavailable' },
          runtimePair: { status: 'unavailable' },
        }),
      ],
      regressions: { status: 'pass' },
      exitCode: 0,
    });
    assert.match(summary, /lesunb\/bsn at `f939d3c`/);
    assert.match(summary, /\| SA-BSN \(#94, cc808b6\) \| ✅ \| ✅ \| ✅ \|/);
    assert.match(summary, /\| File \| cc808b6 \| 5305bc1 \|/);
    assert.match(summary, /\| BSN\.nm \| ❌ \| — \|/);
    assert.match(summary, /\| CostMax\.pctl \| ❌ \| — \|/);
    assert.match(summary, /\| CostMin\.pctl \| ✅ \| — \|/);
    assert.match(
      summary,
      /\*\*SA-BSN cc808b6\*\* · mdp \(informational: param\.zip's generator version is unknown\): CTX_1/,
    );
    assert.match(summary, /\*\*SA-BSN 5305bc1\*\* · generates: no context/);
  });
});

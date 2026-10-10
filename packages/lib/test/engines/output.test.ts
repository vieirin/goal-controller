/** Engines' outputs as files (goal-controller#33): one primary file each, and an engine of three. */
import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { before, describe, it } from 'mocha';
import { writeOutputFiles } from '../../src/cli/outputFiles';
import {
  edgeEngineMapper,
  edgeOutput,
  generateValidatedPrismModel,
} from '../../src/engines/edge';
import { initLogger } from '../../src/engines/edge/logger/logger';
import {
  edgeEngineMapper as edgeV2EngineMapper,
  edgeV2Output,
  generateValidatedPrismModel as generateEdgeV2PrismModel,
} from '../../src/engines/edgeV2';
import { initLogger as initEdgeV2Logger } from '../../src/engines/edgeV2/logger/logger';
import {
  mutroseEngineMapper,
  mutroseOutput,
  mutroseRuntimeAnnotation,
} from '../../src/engines/mutrose';
import {
  engineOutputProblems,
  primaryFile,
  type EngineOutput,
} from '../../src/engines/output';
import {
  sleecEngineMapper,
  sleecOutput,
  sleecTemplateEngine,
} from '../../src/engines/sleec';
import { threeFileEngine } from '../support/threeFileEngine';

const EDGE = '../../examples/edge/experiments/8-minimalMaintain.txt';
const EDGE_V2 = '../../examples/edgeV2/simpleChoiceRewards.txt';
const SLEEC = '../../examples/sleec/goalModel-sleec.txt';
const MUTROSE = '../../examples/mutrose/MedicineDelivery.txt';

const edgeTree = () =>
  GoalTree.fromModel(Model.load(EDGE), edgeEngineMapper).nodes;
const edgeV2Tree = () =>
  GoalTree.fromModel(Model.load(EDGE_V2), edgeV2EngineMapper).nodes;

/** Every engine through its output path, with the string it made before (#33). */
const ENGINES: Array<{
  engine: string;
  output: () => EngineOutput;
  text: () => string;
  fileName: string;
}> = [
  {
    engine: 'edge',
    output: () =>
      edgeOutput({ gm: edgeTree(), fileName: 'lab.txt', writeReport: false }),
    text: () =>
      generateValidatedPrismModel({
        gm: edgeTree(),
        fileName: 'lab.txt',
        writeReport: false,
      }),
    fileName: 'lab.prism',
  },
  {
    engine: 'edgeV2',
    output: () =>
      edgeV2Output({ gm: edgeV2Tree(), fileName: 'lab', writeReport: false }),
    text: () =>
      generateEdgeV2PrismModel({
        gm: edgeV2Tree(),
        fileName: 'lab',
        writeReport: false,
      }),
    fileName: 'lab.prism',
  },
  {
    engine: 'sleec',
    output: () =>
      sleecOutput(
        GoalTree.fromModel(Model.load(SLEEC), sleecEngineMapper).nodes,
        {
          modelName: 'lab.json',
          generateFluents: false,
        },
      ),
    text: () =>
      sleecTemplateEngine(
        GoalTree.fromModel(Model.load(SLEEC), sleecEngineMapper).nodes,
        {
          generateFluents: false,
        },
      ),
    fileName: 'lab.sleec',
  },
  {
    engine: 'mutrose',
    output: () =>
      mutroseOutput(
        GoalTree.fromModel(Model.load(MUTROSE), mutroseEngineMapper).nodes,
        {
          modelName: 'lab',
        },
      ),
    text: () =>
      mutroseRuntimeAnnotation(
        GoalTree.fromModel(Model.load(MUTROSE), mutroseEngineMapper).nodes,
      ),
    fileName: 'lab.rannot',
  },
];

describe('engine outputs', () => {
  before(() => {
    initLogger('output-test', false, true);
    initEdgeV2Logger('output-test', false, true);
  });

  for (const { engine, output, text, fileName } of ENGINES)
    it(`${engine}: one primary file, named after the model, with the text it made before`, () => {
      const { files } = output();
      assert.deepStrictEqual(engineOutputProblems({ files }), []);
      assert.strictEqual(files.length, 1);
      assert.strictEqual(primaryFile({ files }).fileName, fileName);
      assert.strictEqual(primaryFile({ files }).text, text());
    });

  it('a fixture engine of three files: exactly one primary, ids and names apart', () => {
    const output = threeFileEngine(['G1', 'G2'], { modelName: 'lab.txt' });
    assert.deepStrictEqual(engineOutputProblems(output), []);
    assert.strictEqual(primaryFile(output).id, 'model');
    assert.strictEqual(primaryFile(output).fileName, 'lab.nm');
  });

  it('reports no primary, two primaries, and a repeated id or file name', () => {
    const file = { id: 'a', fileName: 'a.txt', text: '' };
    assert.deepStrictEqual(engineOutputProblems({ files: [file] }), [
      'expected exactly one primary file, got 0',
    ]);
    assert.deepStrictEqual(
      engineOutputProblems({
        files: [
          { ...file, primary: true },
          { ...file, primary: true },
        ],
      }),
      [
        'expected exactly one primary file, got 2',
        'id a is used twice',
        'fileName a.txt is used twice',
      ],
    );
    assert.throws(() => primaryFile({ files: [file] }), /exactly one primary/);
  });

  it('the CLI writes every file into the output directory, by its name', () => {
    const directory = mkdtempSync(join(tmpdir(), 'engine-output-'));
    try {
      const written = writeOutputFiles(
        directory,
        threeFileEngine(['G1'], { modelName: 'lab' }),
      );
      assert.deepStrictEqual(written, [
        join(directory, 'lab.nm'),
        join(directory, 'ReachabilityMax.pctl'),
        join(directory, 'evaluate.sh'),
      ]);
      assert.deepStrictEqual(readdirSync(directory).sort(), [
        'ReachabilityMax.pctl',
        'evaluate.sh',
        'lab.nm',
      ]);
      assert.strictEqual(
        readFileSync(join(directory, 'evaluate.sh'), 'utf8'),
        'echo G1',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('refuses a file name outside the output directory, and writes nothing', () => {
    const one = (fileName: string) => ({
      files: [{ id: 'model', fileName, text: 'mdp', primary: true }],
    });
    for (const fileName of ['../x.nm', '/etc/x.nm', 'a/../../b', 'a\\b', ''])
      assert.deepStrictEqual(
        engineOutputProblems(one(fileName)).length,
        1,
        fileName,
      );
    assert.deepStrictEqual(engineOutputProblems(one('goda/Lab.nm')), []);
    const parent = mkdtempSync(join(tmpdir(), 'engine-output-'));
    const directory = join(parent, 'out');
    try {
      assert.throws(
        () => writeOutputFiles(directory, one('../escaped.nm')),
        /not a path inside out/,
      );
      assert.deepStrictEqual(readdirSync(parent), []);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  // previousOutput: an Edge engine reads the previous run's primary file
  const handEdit = (prism: string): string =>
    prism.replace(
      'module System',
      "module System\n  [achieved_T3] true -> 0.6: (inFlight'=true) + 0.4: (inFlight'=false);",
    );
  for (const { engine, generate, legacy, tree } of [
    {
      engine: 'edge',
      generate: edgeOutput,
      legacy: generateValidatedPrismModel,
      tree: edgeTree,
    },
    {
      engine: 'edgeV2',
      generate: edgeV2Output,
      legacy: generateEdgeV2PrismModel,
      tree: edgeV2Tree,
    },
  ] as const)
    it(`${engine}: a second run reads the first one's primary file as previousOutput`, () => {
      const options = { fileName: 'lab', writeReport: false };
      const first = generate({ gm: tree(), ...options, clean: true });
      const previousOutput = handEdit(primaryFile(first).text);
      const second = generate({ gm: tree(), ...options, previousOutput });
      // the same as the string path given the same previous output
      assert.strictEqual(
        primaryFile(second).text,
        legacy({ gm: tree(), ...options, previousOutput }),
      );
      assert.ok(primaryFile(second).text.includes('[achieved_T3]'));
      assert.notStrictEqual(primaryFile(second).text, primaryFile(first).text);
    });
});

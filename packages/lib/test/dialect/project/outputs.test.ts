/**
 * An engine's several outputs (goal-controller#33) in the workbench
 * (packages/ui/lib/workbench/outputs.ts: tabs, trace, previousOutput,
 * downloads) and in its projects (packages/ui/lib/project/outputs.ts).
 */
import { expect } from 'chai';
import { strFromU8, unzipSync } from '../../../../ui/node_modules/fflate';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  directoryStore,
  fileStore,
  openProject,
  parseManifest,
  projectListing,
  readOutputs,
  saveProject,
  withModelSettings,
  withOutputs,
  ManifestError,
} from '../../../../ui/lib/project';
import {
  activeFileOf,
  generatedFrom,
  inputsHash,
  lastGoodRun,
  outputArchive,
  outputDownloadExtension,
  outputFileTabs,
  outputsToSave,
  previousOutputOf,
  primaryOf,
  savedRun,
  traceOfFile,
  type OutputFile,
} from '../../../../ui/lib/workbench/outputs';
import { modelSignature } from '../../../../ui/lib/workbench/signature';
import { threeFileEngine } from '../../support/threeFileEngine';
import { fakeDirectory, type Tree } from './support';

const MODEL = withModelSettings(
  readFileSync(
    join(__dirname, '../../../../../examples/edge/simpleSequential.txt'),
    'utf8',
  ),
  { mode: 'edge', options: { clean: true } },
);
const three = (goals: string[]) =>
  threeFileEngine(goals, { modelName: 'lab.txt' }).files;

describe('engine outputs in the workbench', () => {
  it('one tab per file in the engine’s order; a single file keeps the engine’s label', () => {
    expect(outputFileTabs(three(['G1']), 'PRISM')).to.deep.equal([
      { id: 'reachability-max', label: 'ReachabilityMax.pctl' },
      { id: 'model', label: 'lab.nm' },
      { id: 'evaluate', label: 'evaluate.sh' },
    ]);
    const [, model] = three(['G1']);
    expect(outputFileTabs([model!], 'PRISM')).to.deep.equal([
      { id: 'model', label: 'PRISM' },
    ]);
  });

  it('shows the chosen file, else the primary (not the first)', () => {
    const files = three(['G1']);
    expect(primaryOf(files)?.id).to.equal('model');
    expect(activeFileOf(files, null)?.id).to.equal('model');
    expect(activeFileOf(files, 'evaluate')?.id).to.equal('evaluate');
    // a file the engine no longer makes: the primary
    expect(activeFileOf(files, 'gone')?.id).to.equal('model');
  });

  it("previousOutput is the latest successful run's primary file, of the same engine", () => {
    const run = (engine: string, files: OutputFile[] | null) => ({
      engine,
      files,
    });
    const runs = [
      run('edge', null), // failed
      run('sleec', [
        { id: 's', fileName: 'm.sleec', text: 'sleec', primary: true },
      ]),
      run('edge', three(['G2'])),
      run('edge', three(['G1'])),
    ];
    expect(previousOutputOf(runs, 'edge')).to.equal(
      'mdp\n\nmodule G2\nendmodule\n',
    );
    expect(previousOutputOf(runs, 'mutrose')).to.equal(undefined);
    expect(lastGoodRun(runs)?.engine).to.equal('sleec');
  });

  it('traces a file by the owners its engine gives, the primary by its identifiers, any other not at all', () => {
    const [properties, model, script] = three(['G1', 'G2']);
    expect(traceOfFile(script!, ['G1', 'G2'])?.lines).to.deep.equal([
      { primary: ['G1'], mentions: [] },
      { primary: ['G2'], mentions: [] },
    ]);
    expect(
      traceOfFile(model!, ['G1', 'G2'])?.outline.map((entry) => entry.owner),
    ).to.deep.equal(['G1', 'G2']);
    expect(traceOfFile(properties!, ['G1', 'G2'])).to.equal(null);
  });

  it('downloads each file by its name, and all of them as one zip', () => {
    const files = three(['G1']);
    expect(outputDownloadExtension(files)).to.equal('zip');
    expect(outputDownloadExtension([files[1]!])).to.equal('nm');
    const { fileName, bytes } = outputArchive(files, 'lab.txt');
    expect(fileName).to.equal('lab-output.zip');
    const zipped = unzipSync(bytes);
    expect(Object.keys(zipped)).to.deep.equal([
      'lab-output/ReachabilityMax.pctl',
      'lab-output/lab.nm',
      'lab-output/evaluate.sh',
    ]);
    expect(strFromU8(zipped['lab-output/evaluate.sh']!)).to.equal('echo G1');
  });

  it('hashes what a run was generated from; the embedded manifest is not part of it', () => {
    expect(inputsHash('a')).to.equal(inputsHash('a'));
    expect(inputsHash('a')).not.to.equal(inputsHash('b'));
    const plain = JSON.parse(MODEL);
    delete plain.project;
    expect(MODEL).to.contain('"project"');
    expect(modelSignature(MODEL)).to.equal(
      modelSignature(JSON.stringify(plain)),
    );
  });
});

describe('engine outputs in a project', () => {
  it('saves three files as three OutputEntry rows under out/; a second run replaces them', async () => {
    const tree: Tree = { 'lab.txt': MODEL };
    const project = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    expect(project.form).to.equal('embedded');

    const first = withOutputs(project, {
      model: 'lab.txt',
      engine: 'edge',
      files: three(['G1']),
      inputs: 'h1',
    });
    const saved = await saveProject(
      first.project,
      first.changes,
      first.project.manifest,
    );
    // promoted: three files, and project.json listing them
    expect(saved.form).to.equal('file');
    expect(Object.keys(tree).sort()).to.deep.equal([
      'lab.txt',
      'out',
      'project.json',
    ]);
    expect(Object.keys(tree.out as Tree).sort()).to.deep.equal([
      'ReachabilityMax.pctl',
      'evaluate.sh',
      'lab.nm',
    ]);
    const rows = (manifest: unknown) => parseManifest(manifest).outputs;
    expect(rows(JSON.parse(tree['project.json'] as string))).to.deep.equal([
      {
        model: 'lab.txt',
        path: 'out/ReachabilityMax.pctl',
        engine: 'edge',
        id: 'reachability-max',
        inputs: 'h1',
      },
      {
        model: 'lab.txt',
        path: 'out/lab.nm',
        engine: 'edge',
        id: 'model',
        primary: true,
        inputs: 'h1',
      },
      {
        model: 'lab.txt',
        path: 'out/evaluate.sh',
        engine: 'edge',
        id: 'evaluate',
        inputs: 'h1',
      },
    ]);
    // the model's options moved to project.json with the promotion
    expect(JSON.parse(tree['project.json'] as string).options).to.deep.equal({
      clean: true,
    });

    // regenerated: the same three rows, replaced (another model's and engine's kept)
    const other = {
      model: 'other.txt',
      path: 'out/other.sleec',
      engine: 'sleec',
    };
    const reopened = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    const withOther = {
      ...reopened,
      manifest: {
        ...reopened.manifest,
        outputs: [other, ...reopened.manifest.outputs],
      },
      outputs: [other, ...reopened.outputs],
    };
    const second = withOutputs(withOther, {
      model: 'lab.txt',
      engine: 'edge',
      files: three(['G1', 'G2']),
      inputs: 'h2',
    });
    await saveProject(second.project, second.changes, second.project.manifest);
    const outputs = rows(JSON.parse(tree['project.json'] as string));
    expect(outputs).to.have.length(4);
    expect(outputs[0]).to.deep.equal(other);
    expect(outputs.slice(1).map((row) => [row.id, row.inputs])).to.deep.equal([
      ['reachability-max', 'h2'],
      ['model', 'h2'],
      ['evaluate', 'h2'],
    ]);
    expect((tree.out as Tree)['evaluate.sh']).to.equal('echo G1\necho G2');

    // listed as the project's outputs, and read back in the engine's order
    const again = await openProject(directoryStore(fakeDirectory('lab', tree)));
    expect(
      projectListing(again.manifest, again.files, [], ['lab.txt'])
        .filter((file) => file.role === 'output')
        .map((file) => file.path),
    ).to.deep.equal([
      'out/ReachabilityMax.pctl',
      'out/evaluate.sh',
      'out/lab.nm',
    ]);
    const read = await readOutputs(again, 'lab.txt', 'edge');
    expect(read?.inputs).to.equal('h2');
    expect(
      read?.files.map((file) => [file.id, file.fileName, !!file.primary]),
    ).to.deep.equal([
      ['reachability-max', 'ReachabilityMax.pctl', false],
      ['model', 'lab.nm', true],
      ['evaluate', 'evaluate.sh', false],
    ]);
    expect(await readOutputs(again, 'lab.txt', 'sleec')).to.equal(null);
  });

  it('reads outputs written before #33 (no id, no primary): the first is primary', async () => {
    const tree: Tree = {
      'project.json': JSON.stringify({
        version: 1,
        models: [{ path: 'lab.txt' }],
        outputs: [{ model: 'lab.txt', path: 'out/lab.prism', engine: 'edge' }],
      }),
      'lab.txt': MODEL,
      out: { 'lab.prism': 'dtmc' },
    };
    const project = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    expect(await readOutputs(project, 'lab.txt', 'edge')).to.deep.equal({
      model: 'lab.txt',
      engine: 'edge',
      files: [
        {
          id: 'out/lab.prism',
          fileName: 'lab.prism',
          text: 'dtmc',
          primary: true,
        },
      ],
    });
    // listed but not generated yet: nothing to show
    const bare = await openProject(fileStore('lab.txt', MODEL));
    expect(await readOutputs(bare, 'lab.txt', 'edge')).to.equal(null);
  });

  it('the manifest stays version 1: the new fields are optional and checked', () => {
    const manifest = (output: object) => ({
      version: 1,
      models: [{ path: 'lab.txt' }],
      outputs: [{ model: 'lab.txt', path: 'out/lab.nm', ...output }],
    });
    expect(
      parseManifest(manifest({ id: 'model', primary: true, inputs: 'x' }))
        .outputs,
    ).to.deep.equal([
      {
        model: 'lab.txt',
        path: 'out/lab.nm',
        id: 'model',
        primary: true,
        inputs: 'x',
      },
    ]);
    expect(() => parseManifest(manifest({ primary: 'yes' })))
      .to.throw(ManifestError)
      .with.property('at', 'outputs[0].primary');
    expect(() => parseManifest(manifest({ id: '' })))
      .to.throw(ManifestError)
      .with.property('at', 'outputs[0].id');
  });
});

describe('engine outputs: file names that leave out/', () => {
  it('are refused before anything is written to the project', async () => {
    const project = await openProject(
      directoryStore(fakeDirectory('lab', { 'lab.txt': MODEL })),
    );
    const save = (fileName: string) =>
      withOutputs(project, {
        model: 'lab.txt',
        engine: 'goda',
        files: [{ id: 'model', fileName, text: 'mdp', primary: true }],
      });
    for (const fileName of [
      '../project.json',
      '../../x.nm',
      'sub/../../lab.txt',
      '/etc/x.nm',
    ])
      expect(() => save(fileName), fileName).to.throw(/inside out\//);
    // a folder inside out/ is fine
    expect(Object.keys(save('goda/Lab.nm').changes)).to.include(
      'out/goda/Lab.nm',
    );
  });
});

describe('engine outputs: a run read from the project', () => {
  const files = three(['G1']);
  const signature = 'the model, its engine and options';

  it('is current while its inputs hash to the model’s signature', () => {
    const fresh = savedRun(
      { files, inputs: inputsHash(signature) },
      { id: 1, engine: 'edge', at: 0 },
    );
    expect(generatedFrom(fresh, signature)).to.equal(true);
    expect(generatedFrom(fresh, `${signature} changed`)).to.equal(false);
    expect(generatedFrom(fresh, null)).to.equal(false);
    // entries written before #33 keep no hash: never current
    const old = savedRun({ files }, { id: 2, engine: 'edge', at: 0 });
    expect(old.inputs).to.equal('');
    expect(generatedFrom(old, signature)).to.equal(false);
    // a run generated here compares its own signature
    expect(generatedFrom({ signature }, signature)).to.equal(true);
  });

  it('gives an Edge engine its primary file as previousOutput', async () => {
    // saved as saveOutputs does, read back as the workbench does on opening
    const tree: Tree = { 'lab.txt': MODEL };
    const project = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    const generated = {
      engine: 'edge',
      files,
      signature,
    };
    const outputs = outputsToSave(generated, 'lab.txt')!;
    expect(outputs.inputs).to.equal(inputsHash(signature));
    const { project: written, changes } = withOutputs(project, outputs);
    await saveProject(written, changes, written.manifest);
    const reopened = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    const saved = (await readOutputs(reopened, 'lab.txt', 'edge'))!;
    const run = savedRun(saved, { id: 1, engine: 'edge', at: 0 });
    expect(generatedFrom(run, signature)).to.equal(true);
    expect(previousOutputOf([run], 'edge')).to.equal(
      files.find((file) => file.primary)!.text,
    );
    // another engine's saved run is not Edge's previous output
    expect(previousOutputOf([run], 'edgev2')).to.equal(undefined);
    // a failed run has nothing to save
    expect(outputsToSave({ ...generated, files: null }, 'lab.txt')).to.equal(
      null,
    );
  });
});

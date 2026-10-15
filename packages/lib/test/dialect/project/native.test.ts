/**
 * A model's native files in its project (goal-controller#143): opening one
 * makes the project of both files, the manifest lists it, a file the
 * manifest doesn't list is found by the model's name, the sync states, the
 * file written from the model, the listing and the archive. The toy
 * dialect's formats (../support/native/toy.ts) stand for any dialect's.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { expect } from 'chai';
import { nativeFileFor } from '@goal-controller/dialect';
import { gunzipSync, strFromU8 } from '../../../../ui/node_modules/fflate';
import {
  EMBEDDED_KEY,
  exportArchive,
  importFiles,
  ManifestError,
  modelText,
  nativeProjectFiles,
  nativeSync,
  needsProjectFile,
  openProject,
  parseManifest,
  PROJECT_FILE,
  projectListing,
  serializeManifest,
  untar,
  writeNative,
  type OpenProjectOptions,
} from '../../../../ui/lib/project';
import {
  checkNatives,
  followed,
  inSyncNow,
  nativeProblems,
  nativeStates,
  openAccept,
  trackingFor,
  type NativeTracking,
} from '../../../../ui/lib/workbench/nativeFiles';
import { choresDialect } from '../support/native/toy';
import { fakeDirectory, type Tree } from './support';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'native', name), 'utf8');

const OPTIONS: OpenProjectOptions = {
  nativeFiles: (dialect) =>
    dialect === 'chores' ? choresDialect.nativeFiles : undefined,
};
const { board, chores } = choresDialect.nativeFiles;
const context = { modelName: 'house' };

/** a native file opened, as the workbench opens it: its project, in a fake browser store */
const opened = async (fileName: string, text: string) => {
  const found = nativeFileFor([choresDialect], fileName)!;
  const read = found.file.read(text, { modelName: found.baseName });
  if (!read.model) throw new Error('not read');
  const { files } = nativeProjectFiles(fileName, text, found, read);
  const tree: Tree = {};
  const store = await importFiles(files, 'house', fakeDirectory('root', tree));
  return { project: await openProject(store, OPTIONS), files, tree };
};

describe('a native file opened: its project (#143)', () => {
  it('makes the project of the model beside the file, project.json listing both', async () => {
    const { project, files } = await opened(
      'house.board',
      fixture('house.board'),
    );
    expect(Object.keys(files).sort()).to.deep.equal([
      'house.board',
      'house.txt',
      PROJECT_FILE,
    ]);
    expect(files['house.board']).to.equal(fixture('house.board'));
    expect(JSON.parse(files[PROJECT_FILE]!)).to.deep.equal({
      version: 1,
      dialect: 'chores',
      models: [{ path: 'house.txt', native: { board: 'house.board' } }],
      projectResources: {},
      outputs: [],
    });
    expect(project.form).to.equal('file');
    expect(project.models.map((m) => [m.path, m.settings.mode])).to.deep.equal([
      ['house.txt', 'chores'],
    ]);
    expect(
      project.natives.map(({ model, id, path, from, missing }) => ({
        model,
        id,
        path,
        from,
        missing,
      })),
    ).to.deep.equal([
      {
        model: 'house.txt',
        id: 'chores',
        path: 'house.chores',
        from: null,
        missing: true,
      },
      {
        model: 'house.txt',
        id: 'board',
        path: 'house.board',
        from: 'manifest',
        missing: false,
      },
    ]);
  });

  it('keeps the reader’s project resources and options in the project', () => {
    const found = nativeFileFor([choresDialect], 'house.board')!;
    const read = {
      model: { actors: [] },
      dialectRecord: {
        engine: 'chores',
        projectResources: {
          plans: { 'plans/a.txt': 'a', 'plans/b.txt': 'b' },
          map: { 'map.xml': '<m/>' },
          none: {},
        },
        options: { strict: true },
      },
      diagnostics: [],
    };
    const { files, manifest } = nativeProjectFiles(
      'house.board',
      'x',
      found,
      read,
    );
    expect(manifest).to.deep.include({
      options: { strict: true },
      projectResources: {
        plans: ['plans/a.txt', 'plans/b.txt'],
        map: 'map.xml',
      },
    });
    expect(files['plans/b.txt']).to.equal('b');
    expect(files['map.xml']).to.equal('<m/>');
  });

  it('finds a native file the manifest doesn’t list at the model’s name', async () => {
    const model = modelText(
      chores.read(fixture('house.chores'), context).model!,
    );
    const project = await openProject(
      (await importFiles(
        {
          'house.txt': model,
          'house.chores': fixture('house.chores'),
          [PROJECT_FILE]: serializeManifest({
            version: 1,
            dialect: 'chores',
            models: [{ path: 'house.txt' }],
            projectResources: {},
            outputs: [],
          }),
        },
        'found',
        fakeDirectory('root', {}),
      )) as never,
      OPTIONS,
    );
    expect(
      project.natives.map(({ id, path, from }) => [id, path, from]),
    ).to.deep.equal([
      ['chores', 'house.chores', 'default'],
      ['board', 'house.board', null],
    ]);
    expect(
      projectListing(
        project.manifest,
        project.files,
        project.resources,
        ['house.txt'],
        project.natives,
      ),
    ).to.deep.equal([
      { path: 'house.txt', role: 'model' },
      { path: 'house.chores', role: 'native', kind: 'chores' },
    ]);
  });

  it('carries the native file in the project’s archive', async () => {
    const { project } = await opened('house.board', fixture('house.board'));
    const { bytes } = await exportArchive(project);
    const entries = untar(gunzipSync(bytes));
    expect([...entries.keys()].sort()).to.deep.equal([
      'house/house.board',
      'house/house.txt',
      'house/project.json',
    ]);
    expect(strFromU8(entries.get('house/house.board')!)).to.equal(
      fixture('house.board'),
    );
  });
});

describe('the manifest’s native files (#143)', () => {
  it('reads, writes and checks a model’s native files, which need project.json', () => {
    const manifest = parseManifest({
      version: 1,
      models: [{ path: 'a.txt', native: { board: 'a.board' } }],
    });
    expect(manifest.models[0]!.native).to.deep.equal({ board: 'a.board' });
    expect(
      parseManifest(JSON.parse(serializeManifest(manifest))),
    ).to.deep.equal(manifest);
    expect(needsProjectFile(manifest)).to.equal(true);
    expect(
      needsProjectFile({
        ...manifest,
        models: [{ path: 'a.txt', native: {} }],
      }),
    ).to.equal(false);
    expect(() =>
      parseManifest({ version: 1, models: [{ path: 'a', native: 'a.board' }] }),
    ).to.throw(ManifestError, 'models[0].native: expected an object');
    expect(() =>
      parseManifest({ version: 1, models: [{ path: 'a', native: { b: 1 } }] }),
    ).to.throw(
      ManifestError,
      'models[0].native.b: expected a non-empty string',
    );
  });
});

describe('the sync rule (#143)', () => {
  const text = fixture('house.chores');
  const model = modelText(chores.read(text, context).model!);

  it('is in sync when the file reads to the model but for what its format can’t carry', () => {
    const moved = JSON.parse(model);
    moved.actors[0].nodes[0].x = 999;
    moved.display = { G1: { width: 1 } };
    // the workbench's own key isn't the model's
    moved[EMBEDDED_KEY] = { options: { a: 1 } };
    expect(
      nativeSync(chores, text, JSON.stringify(moved), context),
    ).to.deep.equal({ state: 'in-sync', diagnostics: [] });
  });

  it('is out of sync when they differ, and says where', () => {
    const edited = JSON.parse(model);
    edited.actors[0].nodes[2].text = 'Sweep twice';
    expect(
      nativeSync(chores, text, JSON.stringify(edited), context),
    ).to.include({
      state: 'out-of-sync',
      why: 'actors.chores.nodes.T1.text is "Sweep" in the file, "Sweep twice" in the model',
    });
    expect(nativeSync(chores, text, '{', context)).to.include({
      state: 'out-of-sync',
      why: 'the model is not piStar JSON',
    });
  });

  it('is unreadable when the file doesn’t read', () => {
    const sync = nativeSync(chores, 'chores', model, context);
    expect(sync.state).to.equal('unreadable');
    expect(sync.diagnostics[0]).to.include({ severity: 'error' });
  });

  it('writes the file from the model, without the workbench’s keys; says why it can’t', () => {
    const withManifest = JSON.stringify({
      ...JSON.parse(model),
      [EMBEDDED_KEY]: { options: { a: 1 } },
    });
    expect(writeNative(chores, withManifest, context).text).to.equal(
      fixture('house.chores'),
    );
    expect(writeNative(chores, '{', context).diagnostics).to.deep.equal([
      { severity: 'error', message: 'the model is not piStar JSON' },
    ]);
    const { write: _write, ...readOnly } = board;
    expect(writeNative(readOnly, model, context)).to.deep.equal({
      text: null,
      diagnostics: [{ severity: 'error', message: 'Board XMI is read only' }],
    });
  });
});

describe('the workbench’s native files (#143)', () => {
  const text = fixture('house.chores');
  const model = modelText(chores.read(text, context).model!);
  const slot = (definition = chores) => ({
    model: 'house.txt',
    id: 'chores',
    definition,
    path: 'house.chores',
    from: 'manifest' as const,
    missing: false,
  });
  const edited = (change: (model: any) => void) => {
    const next = JSON.parse(model);
    change(next);
    return modelText(next);
  };
  const renamed = edited((m) => (m.actors[0].nodes[2].text = 'Sweep twice'));
  const store = { name: 'house' };

  /**
   * The workbench's steps over one file: the file read, checked against the
   * model when it is; each edit of the model, its states and writes.
   */
  const session = (stored: string, opened: string, definition = chores) => {
    let texts: Record<string, string> = { 'house.chores': stored };
    let tracking: NativeTracking = checkNatives(
      trackingFor(null, store),
      [slot(definition)],
      texts,
      opened,
      () => context,
    );
    const states = (modelNow: string) =>
      nativeStates(
        [slot(definition)],
        texts,
        modelNow,
        tracking,
        () => context,
      );
    /** the model now this text: what the follow step writes */
    const edit = (modelNow: string) => {
      const step = followed(tracking, states(modelNow), modelNow);
      tracking = step.tracking;
      for (const { path, text: written } of step.writes) texts[path] = written;
      return step.writes;
    };
    return {
      states,
      edit,
      get tracking() {
        return tracking;
      },
      set tracking(next) {
        tracking = next;
      },
      get text() {
        return texts['house.chores']!;
      },
    };
  };

  it('never writes a file before it is checked, nor another project’s', () => {
    const unchecked = nativeStates(
      [slot()],
      { 'house.chores': text },
      renamed,
      trackingFor(null, store),
      () => context,
    );
    expect(unchecked[0]).to.include({ following: true, write: null, text });
    expect(
      followed(trackingFor(null, store), unchecked, renamed).writes,
    ).to.deep.equal([]);
    // another store's tracking is none of this one's
    const known = inSyncNow(trackingFor(null, store), 'house.chores', model);
    expect(trackingFor(known, store)).to.equal(known);
    expect(trackingFor(known, { name: 'other' }).inSyncWith).to.deep.equal({});
  });

  it('leaves a file in sync as it was written until the model is edited, then writes it once per model text', () => {
    const messy = fixture('messy.chores');
    const run = session(messy, model);
    expect(run.tracking.held).to.deep.equal([]);
    expect(run.edit(model)).to.deep.equal([]);
    expect(run.text).to.equal(messy);
    const [write] = run.edit(renamed);
    expect(write!.text).to.contain('task T1 "Sweep twice" cost 2');
    expect(run.edit(renamed)).to.deep.equal([]);
    // undone: the file follows the model back
    expect(run.edit(model)).to.deep.equal([
      { path: 'house.chores', text: fixture('house.chores') },
    ]);
    expect(nativeProblems(run.states(model))).to.deep.equal([]);
  });

  it('holds a file out of sync when the project opened, never writes it, and says so with both ways out', () => {
    const run = session(text, renamed);
    expect(run.tracking.held).to.deep.equal(['house.chores']);
    expect(run.edit(renamed)).to.deep.equal([]);
    expect(run.text).to.equal(text);
    const [held] = run.states(renamed);
    expect(held).to.include({ following: false, text });
    expect(nativeProblems([held!])).to.deep.equal([
      {
        severity: 'warning',
        source: 'Chore list',
        message:
          'house.chores is out of sync with the model (actors.chores.nodes.T1.text is "Sweep" in the file, "Sweep twice" in the model): regenerate it, or re-import the model from it',
        reveal: { document: 'house.chores', from: 0, to: 0 },
      },
    ]);
    // regenerated: written from the model as it is, then followed
    run.tracking = inSyncNow(run.tracking, 'house.chores', '');
    expect(run.edit(renamed)[0]!.text).to.contain('"Sweep twice"');
    expect(nativeProblems(run.states(renamed))).to.deep.equal([]);
  });

  it('re-imported, the model is in sync with the file: nothing written', () => {
    const run = session(text, renamed);
    run.tracking = inSyncNow(run.tracking, 'house.chores', model);
    expect(run.tracking.held).to.deep.equal([]);
    expect(run.edit(model)).to.deep.equal([]);
    expect(run.text).to.equal(text);
  });

  it('compares a file its dialect only reads, and offers re-importing it', () => {
    const { write: _write, ...readOnly } = chores;
    const run = session(text, model, readOnly);
    expect(run.edit(renamed)).to.deep.equal([]);
    const [state] = run.states(renamed);
    expect(state!.following).to.equal(false);
    expect(nativeProblems([state!])[0]!.message).to.match(
      /: re-import the model from it$/,
    );
    expect(nativeProblems(run.states(model))).to.deep.equal([]);
    expect(
      nativeProblems(session('x', model, readOnly).states(model))[0],
    ).to.include({ severity: 'error' });
  });

  it('says why a model can’t be written, and what writing it said', () => {
    const run = session(text, model);
    const quoted = edited((m) => (m.actors[0].nodes[0].text = 'say "hi"'));
    expect(run.edit(quoted)).to.deep.equal([]);
    expect(run.text).to.equal(text);
    expect(nativeProblems(run.states(quoted))[0]!.message).to.equal(
      'house.chores can\'t be written from the model: say "hi": has a "',
    );
    // a writer's warnings, kept after the write
    const noted = {
      ...chores,
      write: (m: Record<string, unknown>, c: typeof context) => {
        const written = chores.write!(m, c);
        return {
          ...written,
          diagnostics: [
            ...written.diagnostics,
            { severity: 'info' as const, message: 'left out the colours' },
          ],
        };
      },
    };
    const notes = session(text, model, noted);
    expect(notes.edit(renamed)).to.have.length(1);
    expect(nativeProblems(notes.states(renamed))).to.deep.equal([
      {
        severity: 'info',
        source: 'Chore list',
        message: 'house.chores: left out the colours',
        reveal: { document: 'house.chores', from: 0, to: 0 },
      },
    ]);
  });

  it('opens the native files the dialects declare, by their extensions', () => {
    const accept = openAccept(['.chores', '.board'], ['.chores', '.old']).split(
      ',',
    );
    expect(accept.filter((type) => type.startsWith('.'))).to.deep.equal([
      '.txt',
      '.json',
      '.tar.gz',
      '.tgz',
      '.tar',
      '.zip',
      '.chores',
      '.board',
      '.old',
    ]);
  });
});

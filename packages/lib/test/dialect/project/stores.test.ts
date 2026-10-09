/** The project module's stores, opening and saving, and Recent, over fakes. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { strToU8, zipSync } from '../../../../ui/node_modules/fflate';
import {
  directoryStore,
  EMBEDDED_KEY,
  exportZip,
  fileStore,
  forgetRecent,
  githubStore,
  hasUnsavedEdits,
  importZip,
  loadRecent,
  ManifestError,
  openProject,
  opfsProjects,
  opfsStore,
  promote,
  RECENT_KEY,
  ReadOnlyStoreError,
  recentId,
  rememberRecent,
  saveProject,
  serializeManifest,
  unzipProject,
  withModelSettings,
  withModelText,
  type DirectoryHandleLike,
  type FileHandleLike,
  type RecentStorage,
} from '../../../../ui/lib/project';

const ROOT = join(__dirname, '../../../../..');
const example = (path: string) =>
  readFileSync(join(ROOT, 'examples', path), 'utf8');
const EDGE = example('edgeV2/simpleChoice.txt');
const SLEEC = example('sleec/goalModel-sleec.txt');

/** An in-memory folder with the handles' methods a store uses. */
type Tree = { [name: string]: string | Tree };
const fakeDirectory = (name: string, tree: Tree): DirectoryHandleLike => ({
  kind: 'directory',
  name,
  async *values() {
    for (const [child, value] of Object.entries(tree))
      yield typeof value === 'string'
        ? fakeFile(tree, child)
        : fakeDirectory(child, value);
  },
  async getDirectoryHandle(child, options) {
    if (typeof tree[child] !== 'object') {
      if (!options?.create || child in tree)
        throw new Error(`NotFoundError: ${child}`);
      tree[child] = {};
    }
    return fakeDirectory(child, tree[child] as Tree);
  },
  async getFileHandle(child, options) {
    if (typeof tree[child] !== 'string') {
      if (!options?.create || child in tree)
        throw new Error(`NotFoundError: ${child}`);
      tree[child] = '';
    }
    return fakeFile(tree, child);
  },
});
const fakeFile = (tree: Tree, name: string): FileHandleLike => ({
  kind: 'file',
  name,
  getFile: async () => ({ text: async () => tree[name] as string }),
  createWritable: async () => {
    let data = '';
    return {
      write: async (chunk: string) => {
        data += chunk;
      },
      close: async () => {
        tree[name] = data;
      },
    };
  },
});

const fakeStorage = (): RecentStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
};

describe('project stores', () => {
  it('opens a single file as an implicit one-model project', async () => {
    const project = await openProject(fileStore('simpleChoice.txt', EDGE));
    expect(project.form).to.equal('embedded');
    expect(project.name).to.equal('simpleChoice.txt');
    expect(project.source).to.deep.equal({
      kind: 'file',
      name: 'simpleChoice.txt',
    });
    expect(project.models).to.have.length(1);
    expect(project.models[0]!.text).to.equal(EDGE);
    expect(project.models[0]!.settings).to.deep.equal({
      mode: JSON.parse(EDGE).diagram?.customProperties?.engine ?? null,
      options: {},
    });
    expect(project.projectResources).to.deep.equal({});
    expect(project.outputs).to.deep.equal([]);
  });

  it('saves a single file through its owner, and reads its new settings back', async () => {
    const written: string[] = [];
    const store = fileStore('m.txt', EDGE, {
      onWrite: (_name, text) => void written.push(text),
    });
    const project = await openProject(store);
    const text = withModelSettings(EDGE, { options: { discretisation: 4 } });
    const saved = await saveProject(project, { 'm.txt': text });
    expect(written).to.deep.equal([text]);
    expect(saved.models[0]!.settings.options).to.deep.equal({
      discretisation: 4,
    });
    expect(saved.manifest.options).to.deep.equal({ discretisation: 4 });
    // a bare model saved as it is stays as it is: no sidecar, no key
    await saveProject(saved, { 'm.txt': EDGE });
    expect(written[1]).to.equal(EDGE);
    expect(JSON.parse(written[1]!)).not.to.have.property(EMBEDDED_KEY);
  });

  it('opens a model whose JSON does not parse, as an unreadable one-model project', async () => {
    const broken = '{ "actors": [ ';
    const project = await openProject(fileStore('broken.txt', broken));
    expect(project.form).to.equal('embedded');
    expect(project.models).to.deep.equal([
      {
        path: 'broken.txt',
        text: broken,
        settings: { mode: null, options: {} },
        unreadable: true,
      },
    ]);
    // a `project` key that isn't a manifest: the mode record still counts
    const badKey = JSON.stringify({
      ...JSON.parse(withModelSettings(EDGE, { mode: 'edgev2' })),
      [EMBEDDED_KEY]: 'x',
    });
    const read = await openProject(fileStore('m.txt', badKey));
    expect(read.models[0]!.settings).to.deep.equal({
      mode: 'edgev2',
      options: {},
    });
    expect(read.models[0]!.unreadable).to.equal(undefined);
  });

  it('keeps where a file came from, and reads a model text replaced', async () => {
    const source = {
      kind: 'github',
      repo: 'vieirin/goal-controller',
      ref: 'main',
      path: 'examples/edgeV2',
    } as const;
    const project = await openProject(fileStore('m.txt', EDGE, { source }));
    expect(project.source).to.deep.equal(source);
    const recorded = withModelText(
      project,
      'm.txt',
      withModelSettings(EDGE, { mode: 'edgev2' }),
    );
    expect(recorded.models[0]!.settings.mode).to.equal('edgev2');
    expect(recorded.manifest.dialect).to.equal('edgev2');
    expect(() => withModelText(project, 'other.txt', EDGE)).to.throw(
      /no model other\.txt/,
    );
  });

  it('refuses to write a read-only file', async () => {
    const project = await openProject(fileStore('m.txt', EDGE));
    await saveProject(project, { 'm.txt': EDGE }).then(
      () => expect.fail('saved'),
      (error) => expect(error).to.be.instanceOf(ReadOnlyStoreError),
    );
  });

  it('reads a folder with one model as a one-model project, whatever else is in it', async () => {
    const tree: Tree = {
      'model.txt': EDGE,
      'notes.txt': 'not json',
      props: { 'a.pctl': 'P>=1 [F done]' },
    };
    const project = await openProject(
      directoryStore(fakeDirectory('lab', tree)),
    );
    expect(project.form).to.equal('embedded');
    expect(project.models.map((m) => m.path)).to.deep.equal(['model.txt']);
    expect(project.source).to.deep.equal({
      kind: 'directory',
      key: 'lab',
      name: 'lab',
    });
  });

  it('reads a folder by its project.json, a model override over the project default', async () => {
    const manifest = {
      version: 1 as const,
      dialect: 'edgev2',
      options: { discretisation: 10 },
      models: [
        { path: 'models/a.txt' },
        {
          path: 'models/a-sleec.txt',
          dialect: 'sleec',
          options: { generateFluents: true },
        },
      ],
      projectResources: {},
      outputs: [{ model: 'models/a.txt', path: 'out/a.prism' }],
    };
    const tree: Tree = {
      'project.json': serializeManifest(manifest),
      models: { 'a.txt': EDGE, 'a-sleec.txt': SLEEC },
    };
    const project = await openProject(
      directoryStore(fakeDirectory('twins', tree)),
    );
    expect(project.form).to.equal('file');
    expect(project.name).to.equal('twins');
    expect(project.models.map((m) => [m.path, m.settings])).to.deep.equal([
      ['models/a.txt', { mode: 'edgev2', options: { discretisation: 10 } }],
      [
        'models/a-sleec.txt',
        {
          mode: 'sleec',
          options: { discretisation: 10, generateFluents: true },
        },
      ],
    ]);
    expect(project.outputs).to.deep.equal(manifest.outputs);
  });

  it('names what is wrong with a project.json', async () => {
    const open = (tree: Tree) =>
      openProject(directoryStore(fakeDirectory('p', tree)));
    const fails = (tree: Tree, message: RegExp) =>
      open(tree).then(
        () => expect.fail('opened'),
        (error) => {
          expect(error).to.be.instanceOf(ManifestError);
          expect(error.message).to.match(message);
        },
      );
    await fails(
      { 'project.json': '{"version":1,"models":[{"path":7}]}' },
      /^project\.json models\[0\]\.path:/,
    );
    await fails(
      { 'project.json': '{"version":1,"models":[{"path":"m.txt"}]}' },
      /model m\.txt is not in the project/,
    );
    await fails({ 'project.json': '{' }, /^project\.json:/);
    await fails({ 'notes.txt': 'hello' }, /no goal model in p/);
  });

  it('promotes a one-model project to project.json when a second file comes', async () => {
    const withOptions = withModelSettings(EDGE, {
      mode: 'edgev2',
      options: { discretisation: 4 },
    });
    const tree: Tree = { 'model.txt': withOptions };
    const store = directoryStore(fakeDirectory('lab', tree));
    const opened = await openProject(store);
    const { project, changes } = promote(opened);
    expect(project.form).to.equal('file');
    // the options leave the model; its mode record stays
    expect(JSON.parse(changes['model.txt']!)).not.to.have.property(
      EMBEDDED_KEY,
    );
    expect(
      JSON.parse(changes['model.txt']!).diagram.customProperties.engine,
    ).to.equal('edgev2');
    const manifest = {
      ...project.manifest,
      models: [
        ...project.manifest.models,
        { path: 'twin.txt', dialect: 'sleec' },
      ],
    };
    const saved = await saveProject(
      project,
      { ...changes, 'twin.txt': SLEEC },
      manifest,
    );
    expect(JSON.parse(tree['project.json'] as string)).to.deep.equal({
      version: 1,
      dialect: 'edgev2',
      options: { discretisation: 4 },
      models: [{ path: 'model.txt' }, { path: 'twin.txt', dialect: 'sleec' }],
      projectResources: {},
      outputs: [],
    });
    const reopened = await openProject(store);
    expect(reopened.form).to.equal('file');
    expect(reopened.models.map((m) => m.settings)).to.deep.equal(
      saved.models.map((m) => m.settings),
    );
    expect(reopened.models[0]!.settings).to.deep.equal({
      mode: 'edgev2',
      options: { discretisation: 4 },
    });
    // a one-model project that needs project.json is promoted first
    await saveProject(opened, {}, manifest).then(
      () => expect.fail('saved'),
      (error) => expect(error.message).to.match(/promote it first/),
    );
  });

  it('keeps projects in the private file system, in and out as a zip', async () => {
    const root = fakeDirectory('opfs', {});
    const zip = zipSync({
      'lab/model.txt': strToU8(EDGE),
      'lab/props/a.pctl': strToU8('P>=1 [F done]'),
      '__MACOSX/lab/._model.txt': strToU8('junk'),
    });
    expect([...unzipProject(zip).keys()]).to.deep.equal([
      'model.txt',
      'props/a.pctl',
    ]);
    const store = await importZip(zip, 'lab', root);
    expect(await opfsProjects(root)).to.deep.equal(['lab']);
    expect(await store.list()).to.deep.equal(['model.txt', 'props/a.pctl']);
    expect(
      (await openProject(opfsStore('lab', root))).models[0]!.text,
    ).to.equal(EDGE);
    const out = unzipProject(await exportZip(store, 'lab'));
    expect(Object.fromEntries(out)).to.deep.equal({
      'model.txt': EDGE,
      'props/a.pctl': 'P>=1 [F done]',
    });
    expect(() => opfsStore('../x', root)).to.throw(/not a project name/);
  });

  it('reads a GitHub folder from the index, one request per file and no project.json lookup', async () => {
    const requested: string[] = [];
    const store = githubStore({
      ref: 'abc123',
      path: 'examples/edgeV2',
      files: ['simpleChoice.txt'],
      form: 'embedded',
      fetch: async (url) => {
        requested.push(url);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => EDGE,
        };
      },
    });
    const project = await openProject(store);
    expect(requested).to.deep.equal([
      'https://raw.githubusercontent.com/vieirin/goal-controller/abc123/examples/edgeV2/simpleChoice.txt',
    ]);
    expect(project.form).to.equal('embedded');
    expect(store.readOnly).to.equal(true);
    await store.write('x', '').then(
      () => expect.fail('wrote'),
      (error) => expect(error).to.be.instanceOf(ReadOnlyStoreError),
    );
    const missing = githubStore({
      ref: 'main',
      path: 'examples',
      files: ['new model.txt'],
      fetch: async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      }),
    });
    await missing.read('new model.txt').then(
      () => expect.fail('read'),
      (error) =>
        expect(error.message).to.equal(
          "Couldn't load examples/new model.txt: 404 Not Found (not pushed to main?)",
        ),
    );
  });
});

describe('project Recent', () => {
  it('reads entries written before projects as they are', () => {
    const storage = fakeStorage();
    const legacy = [
      {
        fileName: 'lab.txt',
        text: EDGE,
        savedText: EDGE,
        settings: {
          engine: 'edge',
          options: { achievabilitySpace: 3 },
          live: false,
        },
        at: 1,
      },
    ];
    storage.setItem(RECENT_KEY, JSON.stringify(legacy));
    expect(loadRecent(storage)).to.deep.equal(legacy);
  });

  it('keeps one entry per name, newest first, with where it came from', () => {
    const storage = fakeStorage();
    rememberRecent(storage, { fileName: 'a.txt', text: 'A' }, 1);
    rememberRecent(
      storage,
      { fileName: 'b.txt', text: 'B', source: { kind: 'file', name: 'b.txt' } },
      2,
    );
    const entries = rememberRecent(
      storage,
      { fileName: 'a.txt', text: 'A2', savedText: 'A' },
      3,
    );
    expect(entries.map((e) => [e.fileName, e.text, e.at])).to.deep.equal([
      ['a.txt', 'A2', 3],
      ['b.txt', 'B', 2],
    ]);
    expect(loadRecent(storage)[1]!.source).to.deep.equal({
      kind: 'file',
      name: 'b.txt',
    });
    expect(hasUnsavedEdits(entries[0]!)).to.equal(true);
    expect(
      forgetRecent(storage, 'file:a.txt').map((e) => e.fileName),
    ).to.deep.equal(['b.txt']);
  });

  it('keeps an edited local file when the example of the same name is opened', () => {
    const storage = fakeStorage();
    const example = {
      kind: 'github',
      repo: 'vieirin/goal-controller',
      ref: 'main',
      path: 'examples/edgeV2',
    } as const;
    // a local copy with edits not exported yet (an entry from before projects: no source)
    rememberRecent(
      storage,
      { fileName: 'goalModel_TAS_3_.txt', text: 'EDITED', savedText: 'TAS' },
      1,
    );
    rememberRecent(
      storage,
      { fileName: 'goalModel_TAS_3_.txt', text: 'TAS', source: example },
      2,
    );
    const entries = loadRecent(storage);
    expect(
      entries.map((e) => [e.text, e.source?.kind ?? 'legacy']),
    ).to.deep.equal([
      ['TAS', 'github'],
      ['EDITED', 'legacy'],
    ]);
    expect(hasUnsavedEdits(entries[1]!)).to.equal(true);
    // the same example again, or the local file again, replaces only its own entry
    rememberRecent(
      storage,
      { fileName: 'goalModel_TAS_3_.txt', text: 'TAS2', source: example },
      3,
    );
    rememberRecent(
      storage,
      {
        fileName: 'goalModel_TAS_3_.txt',
        text: 'EDITED2',
        savedText: 'TAS',
        source: { kind: 'file', name: 'goalModel_TAS_3_.txt' },
      },
      4,
    );
    expect(loadRecent(storage).map((e) => e.text)).to.deep.equal([
      'EDITED2',
      'TAS2',
    ]);
    expect(loadRecent(storage).map(recentId)).to.deep.equal([
      'file:goalModel_TAS_3_.txt',
      'github:vieirin/goal-controller/examples/edgeV2:goalModel_TAS_3_.txt',
    ]);
  });

  it('moves an edited entry aside when a clean file with the same identity and other text comes in', () => {
    const storage = fakeStorage();
    const name = 'lab.txt';
    const local = { kind: 'file', name } as const;
    // an entry from before projects (no source), with edits not exported
    rememberRecent(
      storage,
      { fileName: name, text: 'EDITED', savedText: 'V1' },
      1,
    );
    // a fresh copy of the file opened again: clean, other text
    rememberRecent(
      storage,
      { fileName: name, text: 'V1', savedText: 'V1', source: local },
      2,
    );
    expect(loadRecent(storage).map((e) => [recentId(e), e.text])).to.deep.equal(
      [
        ['file:lab.txt', 'V1'],
        ['file:lab.txt~1', 'EDITED'],
      ],
    );
    // edits going on replace their own entry: the copy aside stays
    rememberRecent(
      storage,
      { fileName: name, text: 'V1+', savedText: 'V1', source: local },
      3,
    );
    // a second fresh copy over new edits: a second copy aside
    rememberRecent(
      storage,
      { fileName: name, text: 'V2', savedText: 'V2', source: local },
      4,
    );
    expect(loadRecent(storage).map((e) => [recentId(e), e.text])).to.deep.equal(
      [
        ['file:lab.txt', 'V2'],
        ['file:lab.txt~2', 'V1+'],
        ['file:lab.txt~1', 'EDITED'],
      ],
    );
    // the copy aside reopened and edited stays itself
    rememberRecent(
      storage,
      {
        fileName: name,
        text: 'EDITED!',
        savedText: 'V1',
        source: local,
        aside: 1,
      },
      5,
    );
    expect(loadRecent(storage).map((e) => recentId(e))).to.deep.equal([
      'file:lab.txt~1',
      'file:lab.txt',
      'file:lab.txt~2',
    ]);
  });

  it('replaces an edited entry on an export or a reopen with its text', () => {
    const storage = fakeStorage();
    rememberRecent(
      storage,
      { fileName: 'a.txt', text: 'EDITED', savedText: 'V1' },
      1,
    );
    // exported: clean, the same text
    rememberRecent(
      storage,
      { fileName: 'a.txt', text: 'EDITED', savedText: 'EDITED' },
      2,
    );
    expect(loadRecent(storage).map((e) => e.text)).to.deep.equal(['EDITED']);
    // a clean entry is replaced by any clean file
    rememberRecent(storage, { fileName: 'a.txt', text: 'OTHER' }, 3);
    expect(loadRecent(storage).map((e) => e.text)).to.deep.equal(['OTHER']);
  });

  it('survives storage that is broken or full', () => {
    const storage = fakeStorage();
    storage.setItem(RECENT_KEY, '{not json');
    expect(loadRecent(storage)).to.deep.equal([]);
    const full: RecentStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(
      rememberRecent(full, { fileName: 'a.txt', text: 'A' }),
    ).to.deep.equal([]);
  });
});

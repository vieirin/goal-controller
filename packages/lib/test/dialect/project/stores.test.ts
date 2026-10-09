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
  rememberRecent,
  saveProject,
  serializeManifest,
  unzipProject,
  withModelSettings,
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
    const store = fileStore(
      'm.txt',
      EDGE,
      (_name, text) => void written.push(text),
    );
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
    expect(forgetRecent(storage, 'a.txt').map((e) => e.fileName)).to.deep.equal(
      ['b.txt'],
    );
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

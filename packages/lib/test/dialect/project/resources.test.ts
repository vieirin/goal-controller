/** The project module's resources: slots by the dialect's declaration, adding one, copies, folder handles. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  directoryStore,
  EMBEDDED_KEY,
  fileStore,
  formatOf,
  freeName,
  loadRecent,
  memoryHandles,
  openProject,
  opfsStore,
  projectListing,
  readProjectResources,
  recentId,
  rememberDirectory,
  rememberRecent,
  reopenDirectory,
  sourceLabel,
  withModelSettings,
  withProjectResource,
  copyProject,
  type ProjectResourceDeclarations,
} from '../../../../ui/lib/project';
import { edge, mutrose } from '../../../src';
import { fakeDirectory, fakeStorage, type Tree } from './support';

const MODEL = withModelSettings(
  readFileSync(
    join(__dirname, '../../../../../examples/mutrose/MedicineDelivery.txt'),
    'utf8',
  ),
  { mode: 'mutrose' },
);
const WORLD = '<world_db><Location><name>Ward1</name></Location></world_db>';
const DECLARATIONS: Record<string, ProjectResourceDeclarations> = {
  mutrose: mutrose.projectResources,
  edge: edge.projectResources,
};
const options = {
  projectResources: (dialect: string | null) =>
    dialect ? DECLARATIONS[dialect] : undefined,
};

describe('project resources', () => {
  it("lists every kind the model's dialect declares: where it is, or missing", async () => {
    const tree: Tree = {
      'MedicineDelivery.txt': MODEL,
      knowledge: { 'world_db.xml': WORLD },
    };
    const project = await openProject(
      directoryStore(fakeDirectory('ward', tree)),
      options,
    );
    expect(project.form).to.equal('embedded');
    expect(
      project.resources.map((slot) => [
        slot.kind,
        slot.paths,
        slot.from,
        slot.missing,
      ]),
    ).to.deep.equal([
      ['world', ['knowledge/world_db.xml'], 'default', false],
      ['hddl', [], null, true],
      ['configuration', [], null, true],
    ]);
    expect(await readProjectResources(project)).to.deep.equal({
      world: [{ path: 'knowledge/world_db.xml', text: WORLD }],
    });
    // a model of a dialect without resources, or none known: no slots
    const bare = await openProject(fileStore('m.txt', MODEL));
    expect(bare.resources).to.deep.equal([]);
  });

  it('takes the files a many kind accepts from its folder, and says what the manifest lists that is absent', async () => {
    const edgeModel = withModelSettings(MODEL, { mode: 'edge' });
    const tree: Tree = {
      'project.json': JSON.stringify({
        version: 1,
        models: [{ path: 'm.txt' }],
        projectResources: { variables: 'vars/missing.json' },
      }),
      'm.txt': edgeModel,
      props: {
        'a.pctl': 'P=? [ F done ]',
        'b.props': 'R=? [ F x ]',
        'notes.md': '#',
      },
    };
    const project = await openProject(
      directoryStore(fakeDirectory('p', tree)),
      options,
    );
    const [variables, properties] = project.resources;
    expect(variables).to.deep.include({
      kind: 'variables',
      paths: [],
      from: 'manifest',
      absent: ['vars/missing.json'],
      missing: true,
    });
    expect(properties!.paths).to.deep.equal(['props/a.pctl', 'props/b.props']);
    expect(properties!.from).to.equal('default');
  });

  it("adds one to a one-model project: it's promoted, the resource listed in project.json", async () => {
    const withOptions = withModelSettings(MODEL, { options: { reduce: true } });
    const project = await openProject(
      fileStore('ward.txt', withOptions),
      options,
    );
    const { project: added, changes } = withProjectResource(project, 'world', {
      name: 'mine.xml',
      text: WORLD,
    });
    expect(added.form).to.equal('file');
    expect(Object.keys(changes).sort()).to.deep.equal([
      'knowledge/world_db.xml',
      'project.json',
      'ward.txt',
    ]);
    expect(JSON.parse(changes['ward.txt']!)).not.to.have.property(EMBEDDED_KEY);
    expect(JSON.parse(changes['project.json']!)).to.deep.include({
      dialect: 'mutrose',
      options: { reduce: true },
      models: [{ path: 'ward.txt' }],
      projectResources: { world: 'knowledge/world_db.xml' },
    });
    expect(added.resources[0]).to.deep.include({
      kind: 'world',
      missing: false,
      from: 'manifest',
    });
    // a many kind collects its files in its folder
    const edgeProject = await openProject(
      fileStore('m.txt', withModelSettings(MODEL, { mode: 'edge' })),
      options,
    );
    const one = withProjectResource(edgeProject, 'properties', {
      name: 'a.pctl',
      text: 'P=? [F a]',
    });
    const two = withProjectResource(one.project, 'properties', {
      name: 'b.pctl',
      text: 'P=? [F b]',
    });
    expect(two.project.manifest.projectResources).to.deep.equal({
      properties: ['props/a.pctl', 'props/b.pctl'],
    });
    expect(() =>
      withProjectResource(edgeProject, 'world', { name: 'w.xml', text: '' }),
    ).to.throw(/world: not a project resource of this dialect/);
  });

  it('copies a project it cannot write to the browser, labelled as a copy, keeping the original in Recent', async () => {
    const storage = fakeStorage();
    const original = await openProject(fileStore('ward.txt', MODEL), options);
    // the original, with edits, as the workbench keeps it
    const edited = `${MODEL} `;
    rememberRecent(storage, {
      fileName: 'ward.txt',
      text: edited,
      savedText: MODEL,
      source: original.source,
    });
    const { project, changes } = withProjectResource(original, 'world', {
      name: 'world_db.xml',
      text: WORLD,
    });
    const root = fakeDirectory('opfs', {});
    const copy = await copyProject(
      project,
      opfsStore(freeName('ward.txt', []), root, original.source),
      changes,
    );
    expect(copy.form).to.equal('file');
    expect(copy.source).to.deep.equal({
      kind: 'opfs',
      name: 'ward',
      copyOf: { kind: 'file', name: 'ward.txt' },
    });
    expect(sourceLabel(copy.source)).to.equal(
      'ward (browser copy of ward.txt)',
    );
    expect(copy.files).to.deep.equal([
      'knowledge/world_db.xml',
      'project.json',
      'ward.txt',
    ]);
    expect(copy.resources[0]).to.deep.include({
      kind: 'world',
      missing: false,
    });
    expect(await readProjectResources(copy)).to.deep.equal({
      world: [{ path: 'knowledge/world_db.xml', text: WORLD }],
    });
    // Recent: the copy is an entry of its own; the original (and its edits) stays
    rememberRecent(storage, {
      fileName: 'ward.txt',
      text: copy.models[0]!.text,
      savedText: copy.models[0]!.text,
      source: copy.source,
    });
    expect(
      loadRecent(storage).map((entry) => [
        recentId(entry),
        entry.text === edited,
      ]),
    ).to.deep.equal([
      ['opfs:ward:ward.txt', false],
      ['file:ward.txt', true],
    ]);
    expect(freeName('ward.txt', ['ward', 'ward-2'])).to.equal('ward-3');
    expect(freeName('My lab/model.txt', [])).to.equal('My-lab-model');
  });

  it("lists an open project's own files only: its models, resources, outputs and the rest", async () => {
    const tree: Tree = {
      'project.json': JSON.stringify({
        version: 1,
        dialect: 'goda',
        models: [{ path: 'models/BSN.txt' }],
        projectResources: { environment: 'configurationEnvGODA.json' },
        outputs: [{ model: 'models/BSN.txt', path: 'out/Actor.nm' }],
      }),
      models: { 'BSN.txt': MODEL },
      'configurationEnvGODA.json': '{}',
      out: { 'Actor.nm': 'dtmc', 'cost.out': '1.0' },
      'README.md': '# seed',
    };
    const project = await openProject(
      directoryStore(fakeDirectory('goda-bsn', tree)),
      options,
    );
    // a kind no dialect declares (no engine reads goda yet): shown as it is
    expect(project.resources).to.deep.equal([
      {
        kind: 'environment',
        definition: {
          label: 'environment',
          format: 'json',
          path: 'configurationEnvGODA.json',
        },
        paths: ['configurationEnvGODA.json'],
        from: 'manifest',
        absent: [],
        missing: false,
        declared: false,
      },
    ]);
    expect(
      projectListing(project.manifest, project.files, project.resources, [
        'models/BSN.txt',
      ]),
    ).to.deep.equal([
      { path: 'models/BSN.txt', role: 'model' },
      {
        path: 'configurationEnvGODA.json',
        role: 'projectResource',
        kind: 'environment',
      },
      { path: 'README.md', role: 'other' },
      { path: 'out/Actor.nm', role: 'output' },
      { path: 'out/cost.out', role: 'output' },
    ]);
    expect(formatOf('a.jucm')).to.equal('xml');
    expect(formatOf('props/a.pctl')).to.equal('pctl');
    expect(formatOf('eval_formula.sh')).to.equal('text');
  });

  it('keeps the folders a user opened, to reopen them from Recent', async () => {
    const handles = memoryHandles();
    const tree: Tree = { 'm.txt': MODEL };
    const store = await rememberDirectory(
      handles,
      fakeDirectory('ward', tree),
      'ward:1',
    );
    expect(store.source).to.deep.equal({
      kind: 'directory',
      key: 'ward:1',
      name: 'ward',
    });
    const again = await reopenDirectory(handles, {
      kind: 'directory',
      key: 'ward:1',
      name: 'ward',
    });
    expect(await again!.list()).to.deep.equal(['m.txt']);
    expect(
      await reopenDirectory(handles, {
        kind: 'directory',
        key: 'gone',
        name: 'x',
      }),
    ).to.equal(null);
  });
});

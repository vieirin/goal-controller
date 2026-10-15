/**
 * A project as one archive (goal-controller#99): the tar writer and reader,
 * the examples' layout of an exported project, and export → import →
 * export giving the same bytes, on examples/mutrose/medicine-delivery and a
 * one-model project.
 */
import { expect } from 'chai';
import { spawnSync } from 'child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import {
  gunzipSync,
  gzipSync,
  strFromU8,
  strToU8,
  zipSync,
} from '../../../../ui/node_modules/fflate';
import { fakeDirectory, type Tree } from './support';
import {
  archiveBaseName,
  directoryStore,
  exportArchive,
  fileStore,
  importArchive,
  isArchiveName,
  openProject,
  PROJECT_FILE,
  projectEntries,
  readArchive,
  serializeManifest,
  tar,
  untar,
  withOutputs,
  type Project,
} from '../../../../ui/lib/project';

const ROOT = join(__dirname, '../../../../..');
const MEDICINE = join(ROOT, 'examples/mutrose/medicine-delivery');
const EDGE = readFileSync(
  join(ROOT, 'examples/edgeV2/simpleChoice.txt'),
  'utf8',
);

/** A folder on disk, as a fake directory's tree. */
const treeOf = (dir: string): Tree =>
  Object.fromEntries(
    readdirSync(dir).map((name) => {
      const path = join(dir, name);
      return [
        name,
        statSync(path).isDirectory()
          ? treeOf(path)
          : readFileSync(path, 'utf8'),
      ];
    }),
  );

/** Every file under a folder on disk, path → text. */
const filesOf = (dir: string, under = dir): Record<string, string> =>
  Object.fromEntries(
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? Object.entries(filesOf(path, under))
        : [
            [
              relative(under, path).split('\\').join('/'),
              readFileSync(path, 'utf8'),
            ],
          ];
    }),
  );

/** An exported archive's files, path → text, with their folder. */
const contents = (bytes: Uint8Array): Record<string, string> =>
  Object.fromEntries(
    [...untar(gunzipSync(bytes))].map(([path, data]) => [
      path,
      strFromU8(data),
    ]),
  );

const bytesOf = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, text]) => [path, strToU8(text)]));

/** Import an archive into a fake browser file system and open it. */
const importAndOpen = async (
  bytes: Uint8Array,
  name: string,
): Promise<Project> =>
  openProject(await importArchive(bytes, name, fakeDirectory('opfs', {})));

const medicine = () =>
  openProject(
    directoryStore(fakeDirectory('medicine-delivery', treeOf(MEDICINE))),
  );

describe('project archive: tar', () => {
  it('writes ustar: header fields, checksum, 512-byte padding and the two end blocks', () => {
    const archive = tar(bytesOf({ 'p/a.txt': 'hello' }));
    expect(archive.length).to.equal(512 * 4);
    const field = (at: number, width: number) =>
      strFromU8(archive.subarray(at, at + width)).replace(/\0.*$/s, '');
    expect(field(0, 100)).to.equal('p/a.txt');
    expect(field(100, 8)).to.equal('0000644');
    expect(field(124, 12)).to.equal('00000000005');
    expect(field(136, 12)).to.equal('00000000000');
    expect(field(156, 1)).to.equal('0');
    expect(field(257, 6)).to.equal('ustar');
    expect(field(263, 2)).to.equal('00');
    const sum = archive
      .subarray(0, 512)
      .reduce((total, byte, i) => total + (i >= 148 && i < 156 ? 32 : byte), 0);
    expect(Number.parseInt(field(148, 8), 8)).to.equal(sum);
    expect(strFromU8(archive.subarray(512, 517))).to.equal('hello');
    expect(archive.subarray(517).every((byte) => byte === 0)).to.equal(true);
  });

  it('reads back what it writes, in path order, and splits a long path into the prefix', () => {
    const long = `${'folder/'.repeat(20)}file.txt`;
    const files = { 'p/b.txt': 'b', 'p/a.txt': '', [long]: 'x'.repeat(1000) };
    const archive = tar(bytesOf(files));
    const read = untar(archive);
    expect([...read.keys()]).to.deep.equal(['p/a.txt', 'p/b.txt', long].sort());
    for (const [path, text] of Object.entries(files))
      expect(strFromU8(read.get(path)!)).to.equal(text);
    expect(() => tar(bytesOf({ [`${'x'.repeat(300)}.txt`]: '' }))).to.throw(
      /too long a path/,
    );
  });

  it('reads pax and GNU long names, and skips folders; refuses a bad checksum', () => {
    const entry = (name: string, type: string, data: string) => {
      const archive = tar(bytesOf({ [name]: data }));
      archive[156] = type.charCodeAt(0);
      // the checksum again, with the new type
      archive.fill(32, 148, 156);
      const sum = archive.subarray(0, 512).reduce((t, b) => t + b, 0);
      archive.set(strToU8(`${sum.toString(8).padStart(6, '0')}\0 `), 148);
      return archive.subarray(0, archive.length - 1024);
    };
    const pax = `${'deep/'.repeat(30)}model.txt`;
    const record = ` path=${pax}\n`;
    const paxData = `${record.length + String(record.length + 3).length}${record}`;
    const archive = new Uint8Array([
      ...entry('PaxHeader/x', 'x', paxData),
      ...entry('short', '0', 'pax'),
      ...entry('././@LongLink', 'L', 'gnu/long/name.txt\0'),
      ...entry('short2', '0', 'gnu'),
      ...entry('dir/', '5', ''),
      ...new Uint8Array(1024),
    ]);
    const read = untar(archive);
    expect([...read.keys()]).to.deep.equal([pax, 'gnu/long/name.txt']);
    const bad = tar(bytesOf({ a: 'a' }));
    bad[0] = 'b'.charCodeAt(0);
    expect(() => untar(bad)).to.throw(/bad checksum/);
  });

  it('refuses an entry whose size is corrupt or runs past the archive, rather than truncating it', () => {
    const withSize = (size: string) => {
      const archive = tar(bytesOf({ a: 'a' }));
      archive.set(strToU8(size.padEnd(12, '\0')), 124);
      archive.fill(32, 148, 156);
      const sum = archive.subarray(0, 512).reduce((t, b) => t + b, 0);
      archive.set(strToU8(`${sum.toString(8).padStart(6, '0')}\0 `), 148);
      return archive;
    };
    expect(() => untar(withSize('zz'))).to.throw(/bad entry size/);
    // 4096 bytes in an archive of 2048
    expect(() => untar(withSize('00000010000'))).to.throw(/bad entry size/);
  });

  const hasTar = spawnSync('tar', ['--version']).status === 0;
  (hasTar ? it : it.skip)(
    "is read by the system's tar (when on PATH)",
    async () => {
      const { bytes } = await exportArchive(await medicine());
      const dir = mkdtempSync(join(tmpdir(), 'archive-'));
      try {
        writeFileSync(join(dir, 'p.tar.gz'), bytes);
        const run = spawnSync('tar', ['-xzf', 'p.tar.gz'], { cwd: dir });
        expect(run.status, String(run.stderr)).to.equal(0);
        expect(filesOf(join(dir, 'medicine-delivery'))).to.deep.equal(
          filesOf(MEDICINE),
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('project archive: reading', () => {
  const files = { 'lab/project.json': '{}', 'lab/models/m.txt': 'm' };

  it('reads a .tar.gz, a .tar and a .zip, without their top folder', () => {
    const expected = new Map([
      ['project.json', '{}'],
      ['models/m.txt', 'm'],
    ]);
    expect(readArchive(gzipSync(tar(bytesOf(files))))).to.deep.equal(expected);
    expect(readArchive(tar(bytesOf(files)))).to.deep.equal(expected);
    expect(
      readArchive(zipSync(Object.fromEntries(bytesOf(files)))),
    ).to.deep.equal(expected);
    expect(() => readArchive(strToU8('{"actors": []}'))).to.throw(
      /not a \.tar\.gz or \.zip archive/,
    );
  });

  it("leaves out what macOS adds, and keeps a project that isn't in one folder", () => {
    expect(
      projectEntries(
        Object.entries({
          'lab/project.json': strToU8('{}'),
          'lab/._project.json': strToU8('apple'),
          '__MACOSX/lab/._m.txt': strToU8('apple'),
          'lab/': new Uint8Array(),
        }),
      ),
    ).to.deep.equal(new Map([['project.json', '{}']]));
    expect([
      ...projectEntries(
        Object.entries({
          'project.json': strToU8('{}'),
          'm/m.txt': strToU8('m'),
        }),
      ).keys(),
    ]).to.deep.equal(['project.json', 'm/m.txt']);
  });

  it('says which names are archives, and names the project after one', () => {
    for (const name of ['lab.tar.gz', 'LAB.TGZ', 'lab.zip', 'lab.tar'])
      expect(isArchiveName(name), name).to.equal(true);
    for (const name of ['lab.txt', 'lab.json', 'lab.gz'])
      expect(isArchiveName(name), name).to.equal(false);
    expect(archiveBaseName('medicine-delivery.tar.gz')).to.equal(
      'medicine-delivery',
    );
  });
});

describe('project archive: export and import (#99)', () => {
  it('writes medicine-delivery in the examples layout, in a folder named after it', async () => {
    const { fileName, bytes } = await exportArchive(await medicine());
    expect(fileName).to.equal('medicine-delivery.tar.gz');
    const expected = Object.fromEntries(
      Object.entries(filesOf(MEDICINE)).map(([path, text]) => [
        `medicine-delivery/${path}`,
        text,
      ]),
    );
    expect(contents(bytes)).to.deep.equal(expected);
    // no time in the gzip header either: the same project, the same bytes
    expect([...bytes.subarray(4, 8)]).to.deep.equal([0, 0, 0, 0]);
    expect((await exportArchive(await medicine())).bytes).to.deep.equal(bytes);
  });

  it('round-trips medicine-delivery: export → import → export gives the same bytes', async () => {
    const { bytes } = await exportArchive(await medicine());
    const imported = await importAndOpen(bytes, 'medicine-delivery');
    expect(imported.form).to.equal('file');
    expect(imported.manifest).to.deep.equal((await medicine()).manifest);
    expect(imported.source).to.deep.equal({
      kind: 'opfs',
      name: 'medicine-delivery',
    });
    expect((await exportArchive(imported)).bytes).to.deep.equal(bytes);
  });

  it('promotes a one-model project: its manifest becomes project.json, beside the model', async () => {
    const project = await openProject(fileStore('simpleChoice.txt', EDGE));
    const { fileName, bytes } = await exportArchive(project);
    expect(fileName).to.equal('simpleChoice.tar.gz');
    const files = contents(bytes);
    expect(Object.keys(files)).to.deep.equal([
      'simpleChoice/project.json',
      'simpleChoice/simpleChoice.txt',
    ]);
    // a model with no options of its own is unchanged; its mode record stays in it
    expect(files['simpleChoice/simpleChoice.txt']).to.equal(EDGE);
    expect(files['simpleChoice/project.json']).to.equal(
      serializeManifest(project.manifest),
    );
    const imported = await importAndOpen(bytes, 'simpleChoice');
    expect(imported.form).to.equal('file');
    expect(imported.models.map((m) => m.settings)).to.deep.equal(
      project.models.map((m) => m.settings),
    );
    expect((await exportArchive(imported)).bytes).to.deep.equal(bytes);
  });

  it('keeps the last outputs in out/ and the edits not saved yet, and round-trips them', async () => {
    const project = await openProject(fileStore('simpleChoice.txt', EDGE));
    const { project: withRun, changes } = withOutputs(project, {
      model: 'simpleChoice.txt',
      engine: 'edgeV2',
      files: [
        {
          id: 'model',
          fileName: 'simpleChoice.prism',
          text: 'mdp\n',
          primary: true,
        },
        { id: 'props', fileName: 'simpleChoice.props', text: 'P=? [F "x"]\n' },
      ],
      inputs: '1x9b2k7q',
    });
    const notes = { 'notes/todo.md': '- check\n' };
    const { bytes } = await exportArchive(withRun, { ...changes, ...notes });
    const files = contents(bytes);
    expect(Object.keys(files)).to.deep.equal([
      'simpleChoice/notes/todo.md',
      'simpleChoice/out/simpleChoice.prism',
      'simpleChoice/out/simpleChoice.props',
      'simpleChoice/project.json',
      'simpleChoice/simpleChoice.txt',
    ]);
    expect(files['simpleChoice/out/simpleChoice.prism']).to.equal('mdp\n');
    expect(
      JSON.parse(files[`simpleChoice/${PROJECT_FILE}`]!).outputs,
    ).to.deep.equal([
      {
        model: 'simpleChoice.txt',
        path: 'out/simpleChoice.prism',
        engine: 'edgeV2',
        id: 'model',
        primary: true,
        inputs: '1x9b2k7q',
      },
      {
        model: 'simpleChoice.txt',
        path: 'out/simpleChoice.props',
        engine: 'edgeV2',
        id: 'props',
        inputs: '1x9b2k7q',
      },
    ]);
    const imported = await importAndOpen(bytes, 'simpleChoice');
    expect(imported.outputs).to.deep.equal(withRun.manifest.outputs);
    expect((await exportArchive(imported)).bytes).to.deep.equal(bytes);
  });

  it('imports a .zip of a project the same way', async () => {
    const zip = zipSync(
      Object.fromEntries(
        Object.entries(filesOf(MEDICINE)).map(([path, text]) => [
          `medicine-delivery/${path}`,
          strToU8(text),
        ]),
      ),
    );
    const imported = await importAndOpen(zip, 'medicine-delivery');
    expect((await exportArchive(imported)).bytes).to.deep.equal(
      (await exportArchive(await medicine())).bytes,
    );
  });

  it('leaves no half-imported project behind when a write fails', async () => {
    const browser: Tree = {};
    // `a` is a file, so `a/b` can't be written: the import fails after `a`
    const bytes = gzipSync(tar(bytesOf({ 'p/a': 'a', 'p/a/b': 'b' })));
    let error: unknown;
    try {
      await importArchive(bytes, 'lab', fakeDirectory('opfs', browser));
    } catch (caught) {
      error = caught;
    }
    expect(String(error)).to.match(/NotFoundError: a/);
    expect(browser).to.deep.equal({ projects: {} });
  });

  it('refuses an archive with no files', async () => {
    let error: unknown;
    try {
      await importArchive(
        gzipSync(tar(new Map())),
        'empty',
        fakeDirectory('opfs', {}),
      );
    } catch (caught) {
      error = caught;
    }
    expect(String(error)).to.match(/the archive has no files/);
  });
});

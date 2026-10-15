/**
 * A project as one archive (goal-controller#99): written as a `.tar.gz` in
 * the examples' layout (`<name>/project.json`, its models, its project
 * resources, `out/`), read back from a `.tar.gz` or a `.zip`. The tar is
 * written here (POSIX ustar) and compressed with fflate, the module's one
 * dependency. Writing is deterministic (sorted paths, no times, no owners),
 * so exporting what was imported gives the same bytes.
 */
import { gunzipSync, gzipSync, strFromU8, strToU8, unzipSync } from 'fflate';
import { promote, type Project } from './open';
import { cleanName } from './resources';
import { normalizePath, type ProjectStore } from './store';
import { opfsStore, removeOpfsProject } from './stores/opfs';
import type { DirectoryHandleLike } from './stores/directory';

// ---------------------------------------------------------------------------
// tar (POSIX ustar): regular files only
// ---------------------------------------------------------------------------

const BLOCK = 512;

/** An octal field: digits, zero-padded, ending with a NUL. */
const octal = (value: number, width: number): string =>
  `${value.toString(8).padStart(width - 1, '0')}\0`;

/** A path as ustar's name (100 bytes) and prefix (155 bytes), split at a `/`. */
const splitName = (path: string): { name: string; prefix: string } => {
  if (strToU8(path).length <= 100) return { name: path, prefix: '' };
  for (let at = path.indexOf('/'); at !== -1; at = path.indexOf('/', at + 1)) {
    const prefix = path.slice(0, at);
    const name = path.slice(at + 1);
    if (strToU8(prefix).length <= 155 && strToU8(name).length <= 100)
      return { name, prefix };
  }
  throw new Error(`${path}: too long a path for a tar archive`);
};

const header = (path: string, size: number): Uint8Array => {
  const block = new Uint8Array(BLOCK);
  const put = (text: string, at: number) => block.set(strToU8(text), at);
  const { name, prefix } = splitName(path);
  put(name, 0);
  put(octal(0o644, 8), 100); // mode
  put(octal(0, 8), 108); // uid
  put(octal(0, 8), 116); // gid
  put(octal(size, 12), 124);
  put(octal(0, 12), 136); // mtime: none, so the bytes don't depend on when
  put('        ', 148); // the checksum's field counts as spaces
  put('0', 156); // a regular file
  put('ustar\u000000', 257); // magic and version
  put(prefix, 345);
  const sum = block.reduce((total, byte) => total + byte, 0);
  put(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return block;
};

/** A tar of these files (path → bytes), in path order. */
export const tar = (files: ReadonlyMap<string, Uint8Array>): Uint8Array => {
  const parts: Uint8Array[] = [];
  for (const path of [...files.keys()].sort()) {
    const data = files.get(path)!;
    parts.push(header(path, data.length), data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(new Uint8Array(pad));
  }
  // the end of the archive: two empty blocks
  parts.push(new Uint8Array(2 * BLOCK));
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const field = (block: Uint8Array, at: number, width: number): string => {
  const bytes = block.subarray(at, at + width);
  const end = bytes.indexOf(0);
  return strFromU8(end === -1 ? bytes : bytes.subarray(0, end));
};

/** A pax extended header's `path` record, if it has one. */
const paxPath = (data: Uint8Array): string | undefined => {
  const text = strFromU8(data);
  for (const record of text.split('\n')) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match) return match[1];
  }
  return undefined;
};

/**
 * A tar's regular files (path → bytes). Reads ustar, and the long names of
 * pax (`x`) and GNU (`L`) headers, as macOS's and GNU's tar write them.
 */
export const untar = (bytes: Uint8Array): Map<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  let longName: string | undefined;
  for (let at = 0; at + BLOCK <= bytes.length;) {
    const block = bytes.subarray(at, at + BLOCK);
    if (block.every((byte) => byte === 0)) break;
    const stored = Number.parseInt(field(block, 148, 8).trim(), 8);
    const sum = block.reduce(
      (total, byte, i) => total + (i >= 148 && i < 156 ? 32 : byte),
      0,
    );
    if (stored !== sum) throw new Error('not a tar archive (bad checksum)');
    const size = Number.parseInt(field(block, 124, 12).trim() || '0', 8);
    // a corrupt size: fail, rather than read the rest as truncated files
    if (!Number.isFinite(size) || size < 0 || at + BLOCK + size > bytes.length)
      throw new Error('not a tar archive (bad entry size)');
    const type = String.fromCharCode(block[156]!);
    const data = bytes.subarray(at + BLOCK, at + BLOCK + size);
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (type === 'x') longName = paxPath(data) ?? longName;
    else if (type === 'L') longName = field(data, 0, data.length);
    else if (type === '0' || type === '\0') {
      const prefix = field(block, 345, 155);
      const name = field(block, 0, 100);
      files.set(longName ?? (prefix ? `${prefix}/${name}` : name), data);
      longName = undefined;
    } else longName = undefined; // folders, links, global headers
  }
  return files;
};

// ---------------------------------------------------------------------------
// a project's files in and out of an archive
// ---------------------------------------------------------------------------

/**
 * An archive's files as a project's: folders and what macOS adds (`__MACOSX/`,
 * `._` files) left out, and a single top folder (how folders are archived)
 * dropped.
 */
export const projectEntries = (
  entries: Iterable<[string, Uint8Array]>,
): Map<string, string> => {
  const files = [...entries]
    .filter(
      ([path]) =>
        !path.endsWith('/') &&
        !path.startsWith('__MACOSX/') &&
        !(path.split('/').pop() ?? '').startsWith('._'),
    )
    .map(([path, data]): [string, string] => [
      normalizePath(path),
      strFromU8(data),
    ]);
  const tops = new Set(files.map(([path]) => path.split('/')[0]));
  const [top] = tops;
  const nested = tops.size === 1 && files.every(([path]) => path.includes('/'));
  return new Map(
    files.map(([path, text]) => [
      nested ? path.slice(`${top}/`.length) : path,
      text,
    ]),
  );
};

const isGzip = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;
const isZip = (bytes: Uint8Array) =>
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  bytes[2] === 0x03 &&
  bytes[3] === 0x04;
const isTar = (bytes: Uint8Array) =>
  bytes.length >= 512 && strFromU8(bytes.subarray(257, 262)) === 'ustar';

/** A `.tar.gz`, `.tar` or `.zip`'s files, as a project's (projectEntries). */
export const readArchive = (bytes: Uint8Array): Map<string, string> => {
  if (isGzip(bytes)) return projectEntries(untar(gunzipSync(bytes)));
  if (isZip(bytes)) return projectEntries(Object.entries(unzipSync(bytes)));
  if (isTar(bytes)) return projectEntries(untar(bytes));
  throw new Error('not a .tar.gz or .zip archive');
};

/** Whether a file's name says it is an archive the workbench opens as a project. */
export const isArchiveName = (fileName: string): boolean =>
  /\.(tar\.gz|tgz|tar|zip)$/i.test(fileName);

/** An archive's name without its extension: the project's name to start from. */
export const archiveBaseName = (fileName: string): string =>
  fileName.replace(/\.(tar\.gz|tgz|tar|zip)$/i, '');

/** Copies an archive's files into a new browser project (OPFS); `root` replaces the browser's (tests). */
export const importArchive = async (
  bytes: Uint8Array,
  name: string,
  root?: DirectoryHandleLike,
): Promise<ProjectStore> => {
  const files = readArchive(bytes);
  if (files.size === 0) throw new Error('the archive has no files');
  return importFiles(files, name, root);
};

/**
 * Writes files (path → text) into a new browser project (OPFS): an
 * archive's, a native file's project (nativeProjectFiles). `root` replaces
 * the browser's (tests).
 */
export const importFiles = async (
  files: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
  name: string,
  root?: DirectoryHandleLike,
): Promise<ProjectStore> => {
  const store = opfsStore(name, root);
  try {
    const entries = files instanceof Map ? [...files] : Object.entries(files);
    for (const [path, text] of entries) await store.write(path, text);
  } catch (error) {
    // no half-imported project left behind, holding the name
    await removeOpfsProject(name, root);
    throw error;
  }
  return store;
};

/**
 * The project's files, path → text: the store's, with its models as they
 * are now and these changes over them (unsaved edits, a run's outputs:
 * withOutputs). A one-model project is promoted, so its manifest is a
 * project.json, as in the examples' layout.
 */
export const projectFiles = async (
  from: Project,
  changes: Readonly<Record<string, string>> = {},
): Promise<Map<string, string>> => {
  const { project, changes: promoted } = promote(from);
  const over: Record<string, string> = { ...changes, ...promoted };
  const texts = new Map<string, string>();
  for (const path of project.files)
    if (!(path in over)) texts.set(path, await project.store.read(path));
  for (const model of project.models)
    if (!(model.path in over)) texts.set(model.path, model.text);
  for (const [path, text] of Object.entries(over)) texts.set(path, text);
  return texts;
};

/** The project's folder in an archive: its name, cleaned (`lab.txt` → `lab`). */
export const archiveFolder = (project: Project): string =>
  cleanName(project.name);

/**
 * The project as a `.tar.gz` (projectFiles), in a folder named after it:
 * `{ fileName: 'lab.tar.gz', bytes }`. The same project gives the same bytes.
 */
export const exportArchive = async (
  project: Project,
  changes: Readonly<Record<string, string>> = {},
): Promise<{ fileName: string; bytes: Uint8Array }> => {
  const folder = archiveFolder(project);
  const files = new Map<string, Uint8Array>();
  for (const [path, text] of await projectFiles(project, changes))
    files.set(`${folder}/${path}`, strToU8(text));
  return {
    fileName: `${folder}.tar.gz`,
    // mtime 0: no time in the header, so the bytes don't depend on when
    bytes: gzipSync(tar(files), { level: 9, mtime: 0 }),
  };
};

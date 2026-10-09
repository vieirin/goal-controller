import { normalizePath, type ProjectSource, type ProjectStore } from '../store';

/**
 * The parts of the File System Access API's handles a store uses: a folder on
 * disk (showDirectoryPicker) and the browser's private file system (OPFS)
 * both have them, and tests give fakes.
 */
export interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface DirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterable<FileHandleLike | DirectoryHandleLike>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirectoryHandleLike>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandleLike>;
}

/** hidden folders and dependencies are not project files */
const SKIP = (name: string) => name.startsWith('.') || name === 'node_modules';

const listFiles = async (
  dir: DirectoryHandleLike,
  prefix: string,
): Promise<string[]> => {
  const files: string[] = [];
  for await (const entry of dir.values()) {
    if (SKIP(entry.name)) continue;
    const path = `${prefix}${entry.name}`;
    if (entry.kind === 'directory')
      files.push(...(await listFiles(entry, `${path}/`)));
    else files.push(path);
  }
  return files.sort();
};

const fileHandle = async (
  root: DirectoryHandleLike,
  path: string,
  create: boolean,
): Promise<FileHandleLike> => {
  const parts = normalizePath(path).split('/');
  const name = parts.pop();
  if (!name) throw new Error(`${path}: not a file path`);
  let dir = root;
  for (const part of parts)
    dir = await dir.getDirectoryHandle(part, { create });
  return dir.getFileHandle(name, { create });
};

/**
 * A folder's files through its handle. `root` may be resolved on first use
 * (OPFS: no browser global is read before a project is opened).
 */
export const handleStore = (
  source: ProjectSource,
  root: DirectoryHandleLike | (() => Promise<DirectoryHandleLike>),
): ProjectStore => {
  let resolved: Promise<DirectoryHandleLike> | null = null;
  const dir = () =>
    (resolved ??= typeof root === 'function' ? root() : Promise.resolve(root));
  return {
    source,
    readOnly: false,
    list: async () => listFiles(await dir(), ''),
    read: async (path) =>
      (await (await fileHandle(await dir(), path, false)).getFile()).text(),
    write: async (path, text) => {
      const writable = await (
        await fileHandle(await dir(), path, true)
      ).createWritable();
      await writable.write(text);
      await writable.close();
    },
  };
};

/** A folder on disk the user opened; `key` is where its handle is kept between visits. */
export const directoryStore = (
  handle: DirectoryHandleLike,
  key: string = handle.name,
): ProjectStore =>
  handleStore({ kind: 'directory', key, name: handle.name }, handle);

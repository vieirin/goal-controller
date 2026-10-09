/** A project in and out of the browser's private file system, as a zip. */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { normalizePath, type ProjectStore } from './store';
import { opfsStore } from './stores/opfs';
import type { DirectoryHandleLike } from './stores/directory';

/** A zip's files; a single top folder (how folders are usually zipped) is dropped. */
export const unzipProject = (bytes: Uint8Array): Map<string, string> => {
  const entries = Object.entries(unzipSync(bytes))
    // folders, and the files macOS adds
    .filter(([path]) => !path.endsWith('/') && !path.startsWith('__MACOSX/'))
    .map(([path, data]): [string, string] => [
      normalizePath(path),
      strFromU8(data),
    ]);
  const tops = new Set(entries.map(([path]) => path.split('/')[0]));
  const [top] = tops;
  const nested =
    tops.size === 1 && entries.every(([path]) => path.includes('/'));
  return new Map(
    entries.map(([path, text]) => [
      nested ? path.slice(`${top}/`.length) : path,
      text,
    ]),
  );
};

/** Copies a zip into a new OPFS project; `root` replaces the browser's (tests). */
export const importZip = async (
  bytes: Uint8Array,
  name: string,
  root?: DirectoryHandleLike,
): Promise<ProjectStore> => {
  const store = opfsStore(name, root);
  for (const [path, text] of unzipProject(bytes)) await store.write(path, text);
  return store;
};

/** Every file of a project, zipped in a folder named after it. */
export const exportZip = async (
  store: ProjectStore,
  folder: string = 'project',
): Promise<Uint8Array> => {
  const files: Record<string, Uint8Array> = {};
  for (const path of await store.list())
    files[`${folder}/${path}`] = strToU8(await store.read(path));
  return zipSync(files);
};

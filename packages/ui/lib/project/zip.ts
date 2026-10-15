/** A project in and out of the browser's private file system, as a zip. */
import { strToU8, unzipSync, zipSync } from 'fflate';
import { importArchive, projectEntries } from './archive';
import type { ProjectStore } from './store';
import type { DirectoryHandleLike } from './stores/directory';

/** A zip's files; a single top folder (how folders are usually zipped) is dropped. */
export const unzipProject = (bytes: Uint8Array): Map<string, string> =>
  projectEntries(Object.entries(unzipSync(bytes)));

/** Copies a zip into a new OPFS project; `root` replaces the browser's (tests). */
export const importZip = (
  bytes: Uint8Array,
  name: string,
  root?: DirectoryHandleLike,
): Promise<ProjectStore> => importArchive(bytes, name, root);

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

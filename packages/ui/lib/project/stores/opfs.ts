import type { ProjectStore } from '../store';
import { handleStore, type DirectoryHandleLike } from './directory';

/** The folder of the browser's private file system that holds the projects. */
const PROJECTS_DIR = 'projects';

/** The private file system's root, read when a project is first used. */
const opfsRoot = async (): Promise<DirectoryHandleLike> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory)
    throw new Error('this browser has no private file system (OPFS)');
  return (await navigator.storage.getDirectory()) as unknown as DirectoryHandleLike;
};

const projectsDir = async (
  root?: DirectoryHandleLike,
): Promise<DirectoryHandleLike> =>
  (root ?? (await opfsRoot())).getDirectoryHandle(PROJECTS_DIR, {
    create: true,
  });

/**
 * A project in the browser's private file system (OPFS): the fallback where
 * folders can't be opened (Safari, Firefox) and for scratch projects. Moved
 * in and out as a zip (zip.ts). `root` replaces the browser's (tests).
 */
export const opfsStore = (
  name: string,
  root?: DirectoryHandleLike,
): ProjectStore => {
  if (!name || name.includes('/') || name.startsWith('.'))
    throw new Error(`${name}: not a project name`);
  return handleStore({ kind: 'opfs', name }, async () =>
    (await projectsDir(root)).getDirectoryHandle(name, { create: true }),
  );
};

/** The projects kept in the private file system, by name. */
export const opfsProjects = async (
  root?: DirectoryHandleLike,
): Promise<string[]> => {
  const names: string[] = [];
  for await (const entry of (await projectsDir(root)).values())
    if (entry.kind === 'directory') names.push(entry.name);
  return names.sort();
};

/**
 * Reading a project's resources, adding one, and copying a project to a
 * store it can be written in (goal-controller#25). The texts only: what a
 * resource means is its engine's to parse.
 */
import { PROJECT_FILE, serializeManifest, type Manifest } from './manifest';
import {
  openProject,
  promote,
  type OpenProjectOptions,
  type Project,
} from './open';
import { resourceSlots, type ResourceSlot } from './slots';
import { normalizePath, type ProjectStore } from './store';

/** A slot's files, read from the project's store. */
export const readResourceFiles = async (
  project: Project,
  slot: ResourceSlot,
): Promise<{ path: string; text: string }[]> =>
  Promise.all(
    slot.paths.map(async (path) => ({
      path,
      text: await project.store.read(path),
    })),
  );

/** Every present slot's files, by kind. */
export const readProjectResources = async (
  project: Project,
): Promise<Record<string, { path: string; text: string }[]>> =>
  Object.fromEntries(
    await Promise.all(
      project.resources
        .filter((slot) => !slot.missing)
        .map(async (slot) => [
          slot.kind,
          await readResourceFiles(project, slot),
        ]),
    ),
  );

/**
 * The project with a file added to a resource kind (not written): where the
 * declaration keeps it (a `many` kind's folder, with the file's name), listed
 * in the manifest, which moves to project.json (a one-model project is
 * promoted). Returns the files to write: saveProject, or copyProject to a
 * store that can be written.
 */
export const withProjectResource = (
  from: Project,
  kind: string,
  file: { name: string; text: string },
): { project: Project; changes: Record<string, string> } => {
  const definition = from.declarations[kind];
  if (!definition)
    throw new Error(`${kind}: not a project resource of this dialect`);
  const path = normalizePath(
    definition.many ? `${definition.path}${file.name}` : definition.path,
  );
  const { project: promoted, changes } = promote(from);
  const listed = promoted.manifest.projectResources[kind];
  const paths = definition.many
    ? [...new Set([...(listed === undefined ? [] : [listed].flat()), path])]
    : path;
  const manifest: Manifest = {
    ...promoted.manifest,
    projectResources: { ...promoted.manifest.projectResources, [kind]: paths },
  };
  const files = [...new Set([...promoted.files, path, PROJECT_FILE])].sort();
  return {
    project: {
      ...promoted,
      manifest,
      projectResources: manifest.projectResources,
      files,
      resources: resourceSlots(manifest, files, promoted.declarations),
    },
    changes: {
      ...changes,
      [path]: file.text,
      [PROJECT_FILE]: serializeManifest(manifest),
    },
  };
};

/**
 * Copy a project into another store (the browser's private file system, a
 * folder), with these changes over its files, and open the copy. A file
 * project.json lists is written from the project's manifest.
 */
export const copyProject = async (
  from: Project,
  to: ProjectStore,
  changes: Readonly<Record<string, string>> = {},
  options: OpenProjectOptions = { projectResources: () => from.declarations },
): Promise<Project> => {
  const texts: Record<string, string> = {};
  for (const path of from.files)
    if (!(path in changes)) texts[path] = await from.store.read(path);
  // a one-model project's model as it is now (with its unsaved edits)
  for (const model of from.models)
    if (!(model.path in changes)) texts[model.path] = model.text;
  for (const [path, text] of Object.entries({ ...texts, ...changes }))
    await to.write(path, text);
  return openProject(to, options);
};

/** A name not taken yet: `lab`, `lab-2`, `lab-3` … */
export const freeName = (base: string, taken: readonly string[]): string => {
  const clean =
    base
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[.-]+/, '') || 'project';
  if (!taken.includes(clean)) return clean;
  for (let n = 2; ; n += 1)
    if (!taken.includes(`${clean}-${n}`)) return `${clean}-${n}`;
};

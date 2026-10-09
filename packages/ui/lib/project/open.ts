/** Opening, promoting and saving a project, over any store. */
import {
  ManifestError,
  needsProjectFile,
  parseManifest,
  PROJECT_FILE,
  serializeManifest,
  settingsInManifest,
  MANIFEST_VERSION,
  type Manifest,
  type ManifestSettings,
  type OutputEntry,
} from './manifest';
import {
  readEmbeddedManifest,
  recordedMode,
  withEmbeddedManifest,
} from './embedded';
import {
  ReadOnlyStoreError,
  sourceLabel,
  type ManifestForm,
  type ProjectSource,
  type ProjectStore,
} from './store';
import {
  resourceSlots,
  type ProjectResourceDeclarations,
  type ResourceSlot,
} from './slots';

export type ProjectModel = {
  path: string;
  text: string;
  /** what it is read with: its manifest entry over the project's defaults */
  settings: ManifestSettings;
  /** its text isn't JSON (yet): it opens with no settings, the workbench says why */
  unreadable?: true;
};

export type Project = {
  name: string;
  source: ProjectSource;
  store: ProjectStore;
  form: ManifestForm;
  manifest: Manifest;
  models: ProjectModel[];
  /** as the manifest lists them */
  projectResources: Manifest['projectResources'];
  /** what the engines last produced; a missing file means "not generated yet" */
  outputs: OutputEntry[];
  /** every file of the project, from its root */
  files: string[];
  /** the project resources its dialect reads, as data (none: it reads none, or isn't known) */
  declarations: ProjectResourceDeclarations;
  /** each declared kind: where the project has it, or missing */
  resources: ResourceSlot[];
};

/** What openProject asks the workbench: the project resources a dialect reads. */
export type OpenProjectOptions = {
  projectResources?: (
    dialect: string | null,
  ) => ProjectResourceDeclarations | undefined;
};

const MODEL_FILE = /\.(txt|json)$/i;

const baseName = (path: string): string => path.split('/').pop() ?? path;

/** A piStar goal model (some .txt files are PRISM sketches or notes). */
const isGoalModel = (text: string): boolean => {
  try {
    return Array.isArray(JSON.parse(text)?.actors);
  } catch {
    return false;
  }
};

const settingsOf = (
  manifest: Manifest,
  path: string,
  text: string,
): ManifestSettings => {
  const settings = settingsInManifest(manifest, path);
  // the manifest takes precedence; a model it says nothing about keeps its record
  return settings.mode !== null
    ? settings
    : { ...settings, mode: recordedMode(text) };
};

type Shape = {
  store: ProjectStore;
  form: ManifestForm;
  manifest: Manifest;
  models: ProjectModel[];
  name: string;
  files: readonly string[];
  declarations: ProjectResourceDeclarations;
};

const project = ({
  store,
  form,
  manifest,
  models,
  name,
  files,
  declarations,
}: Shape): Project => ({
  name,
  source: store.source,
  store,
  form,
  manifest,
  models,
  projectResources: manifest.projectResources,
  outputs: manifest.outputs,
  files: [...files].sort(),
  declarations,
  resources: resourceSlots(manifest, files, declarations),
});

/** the project's resources the dialect of its (first) model reads */
const declarationsFor = (
  models: readonly ProjectModel[],
  options: OpenProjectOptions,
): ProjectResourceDeclarations =>
  options.projectResources?.(models[0]?.settings.mode ?? null) ?? {};

const embedded = (
  store: ProjectStore,
  path: string,
  text: string,
  files: readonly string[],
  options: OpenProjectOptions,
): Project => {
  const { manifest, unreadable } = readEmbeddedManifest(text, path);
  const models = [
    {
      path,
      text,
      settings: settingsOf(manifest, path, text),
      ...(unreadable && { unreadable: true as const }),
    },
  ];
  return project({
    store,
    form: 'embedded',
    manifest,
    models,
    name: baseName(path),
    files,
    declarations: declarationsFor(models, options),
  });
};

/** the options a project was opened with, again (its declarations, by its own dialect) */
const sameOptions = (from: Project): OpenProjectOptions => ({
  projectResources: () => from.declarations,
});

/**
 * The project with a model's text replaced (not written): its settings read
 * again, and a one-model project's manifest with them.
 */
export const withModelText = (
  from: Project,
  path: string,
  text: string,
): Project => {
  if (!from.models.some((model) => model.path === path))
    throw new ManifestError('models', `no model ${path}`);
  if (from.form === 'embedded')
    return embedded(from.store, path, text, from.files, sameOptions(from));
  return {
    ...from,
    models: from.models.map((model) =>
      model.path === path
        ? { ...model, text, settings: settingsOf(from.manifest, path, text) }
        : model,
    ),
  };
};

const folderName = (source: ProjectSource): string =>
  (source.kind === 'github' ? baseName(source.path) : source.name) || 'project';

/**
 * A project from its store: a project.json's, or a single model's embedded
 * manifest (an implicit one-model project). A folder of several models with
 * no project.json is read as a project of those models, its project.json
 * written on the next save. Throws when there is no model.
 */
export const openProject = async (
  store: ProjectStore,
  options: OpenProjectOptions = {},
): Promise<Project> => {
  const files = await store.list();
  if (store.form === 'embedded') {
    const [path] = files;
    if (files.length !== 1 || !path)
      throw new ManifestError(
        '',
        `a one-model project has one file, not ${files.length}`,
      );
    return embedded(store, path, await store.read(path), files, options);
  }
  if (files.includes(PROJECT_FILE)) {
    const text = await store.read(PROJECT_FILE);
    let manifest: Manifest;
    try {
      manifest = parseManifest(JSON.parse(text));
    } catch (error) {
      throw error instanceof ManifestError
        ? new ManifestError(
            error.at ? `${PROJECT_FILE} ${error.at}` : PROJECT_FILE,
            error.problem,
          )
        : new ManifestError(PROJECT_FILE, (error as Error).message);
    }
    const models = await Promise.all(
      manifest.models.map(async ({ path }) => {
        if (!files.includes(path))
          throw new ManifestError(
            PROJECT_FILE,
            `model ${path} is not in the project`,
          );
        const text = await store.read(path);
        return { path, text, settings: settingsOf(manifest, path, text) };
      }),
    );
    return project({
      store,
      form: 'file',
      manifest,
      models,
      name: folderName(store.source),
      files,
      declarations: declarationsFor(models, options),
    });
  }
  const candidates = await Promise.all(
    files
      .filter((path) => MODEL_FILE.test(path))
      .map(async (path) => ({ path, text: await store.read(path) })),
  );
  const found = candidates.filter(({ text }) => isGoalModel(text));
  const [only] = found;
  if (!only)
    throw new ManifestError(
      '',
      `no goal model in ${sourceLabel(store.source)}`,
    );
  if (found.length === 1)
    return embedded(store, only.path, only.text, files, options);
  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    models: found.map(({ path }) => ({ path })),
    projectResources: {},
    outputs: [],
  };
  const models = found.map(({ path, text }) => ({
    path,
    text,
    settings: settingsOf(manifest, path, text),
  }));
  return project({
    store,
    form: 'file',
    manifest,
    models,
    name: folderName(store.source),
    files,
    declarations: declarationsFor(models, options),
  });
};

/**
 * A one-model project made ready for a second file: its manifest moves to
 * project.json (its options leave the model's `project` key; the mode record
 * stays, the model's own). Returns the files to write with saveProject.
 */
export const promote = (
  from: Project,
): { project: Project; changes: Record<string, string> } => {
  if (from.form === 'file') return { project: from, changes: {} };
  const [model] = from.models;
  if (!model) throw new ManifestError('models', 'a project has a model');
  const { options: _options, ...withoutOptions } = from.manifest;
  const text = withEmbeddedManifest(model.text, withoutOptions);
  return {
    project: {
      ...from,
      form: 'file',
      models: [{ ...model, text }],
    },
    changes: {
      ...(text !== model.text && { [model.path]: text }),
      [PROJECT_FILE]: serializeManifest(from.manifest),
    },
  };
};

/**
 * Write a project's changed files (path → text). A one-model project's
 * manifest is in its model's text (withModelSettings); project.json is
 * written whenever the project has one. Throws on a read-only store, and on
 * a one-model project whose manifest now needs project.json (promote first).
 */
export const saveProject = async (
  from: Project,
  changes: Readonly<Record<string, string>>,
  manifest: Manifest = from.manifest,
): Promise<Project> => {
  if (from.store.readOnly) throw new ReadOnlyStoreError(from.source);
  if (from.form === 'embedded' && needsProjectFile(manifest))
    throw new ManifestError(
      '',
      'this project now has more than one file: promote it first',
    );
  const writes: Record<string, string> =
    from.form === 'file'
      ? { ...changes, [PROJECT_FILE]: serializeManifest(manifest) }
      : { ...changes };
  for (const [path, text] of Object.entries(writes))
    await from.store.write(path, text);
  const files = [...new Set([...from.files, ...Object.keys(writes)])];
  if (from.form === 'embedded') {
    // the manifest is what the model now says
    const [model] = from.models;
    if (!model) throw new ManifestError('models', 'a project has a model');
    return embedded(
      from.store,
      model.path,
      changes[model.path] ?? model.text,
      files,
      sameOptions(from),
    );
  }
  // the models the manifest now lists (one added with this save is in changes)
  const models = await Promise.all(
    manifest.models.map(async ({ path }) => {
      const text =
        changes[path] ??
        from.models.find((model) => model.path === path)?.text ??
        (await from.store.read(path));
      return { path, text, settings: settingsOf(manifest, path, text) };
    }),
  );
  return project({
    store: from.store,
    form: 'file',
    manifest,
    models,
    name: from.name,
    files,
    declarations: from.declarations,
  });
};

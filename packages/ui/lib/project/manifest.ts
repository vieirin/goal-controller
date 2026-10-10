/**
 * The project manifest: what a project holds and how its models are read.
 * Data only; the package never interprets a dialect or its options.
 */

/** An engine's options, opaque here: the workbench merges and validates them. */
export type EngineOptions = Readonly<Record<string, string | number | boolean>>;

export type ModelEntry = {
  /** POSIX path from the project root */
  path: string;
  /** overrides the project's dialect for this model */
  dialect?: string;
  /** overrides the project's options for this model, key by key */
  options?: EngineOptions;
};

/** A file an engine produced from a model; a missing one means "not generated yet". */
export type OutputEntry = {
  /** path of the model it was generated from */
  model: string;
  path: string;
  engine?: string;
  /** the engine's key for the file (EngineOutputFile.id): a later run replaces it */
  id?: string;
  /** the file the engine shows first (one per model and engine) */
  primary?: boolean;
  /** what it was generated from, hashed: another value means the model changed since */
  inputs?: string;
};

export type Manifest = {
  version: 1;
  /** the project's default dialect (engine or modelling dialect); none: plain piStar */
  dialect?: string;
  /** the project's default engine options */
  options?: EngineOptions;
  models: ModelEntry[];
  /** by kind, as the dialect declares them (stage 2) */
  projectResources: Record<string, string | string[]>;
  outputs: OutputEntry[];
};

export const MANIFEST_VERSION = 1;

/** The manifest file of a project with more than one file. */
export const PROJECT_FILE = 'project.json';

export class ManifestError extends Error {
  constructor(
    /** where in the manifest: `models[1].path` */
    readonly at: string,
    readonly problem: string,
  ) {
    super(at ? `${at}: ${problem}` : problem);
    this.name = 'ManifestError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, at: string): string => {
  if (typeof value !== 'string' || !value)
    throw new ManifestError(at, 'expected a non-empty string');
  return value;
};

const optionalStr = (value: unknown, at: string): string | undefined =>
  value === undefined ? undefined : str(value, at);

export const parseOptions = (
  value: unknown,
  at: string,
): EngineOptions | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new ManifestError(at, 'expected an object');
  for (const [key, option] of Object.entries(value))
    if (!['string', 'number', 'boolean'].includes(typeof option))
      throw new ManifestError(
        `${at}.${key}`,
        'expected a string, number or boolean',
      );
  return value as EngineOptions;
};

const parseVersion = (value: unknown, at: string): 1 => {
  if (value !== MANIFEST_VERSION)
    throw new ManifestError(
      at,
      `unsupported version ${JSON.stringify(value)} (this workbench reads ${MANIFEST_VERSION})`,
    );
  return MANIFEST_VERSION;
};

const parseModelEntry = (value: unknown, at: string): ModelEntry => {
  if (!isRecord(value)) throw new ManifestError(at, 'expected an object');
  const dialect = optionalStr(value.dialect, `${at}.dialect`);
  const options = parseOptions(value.options, `${at}.options`);
  return {
    path: str(value.path, `${at}.path`),
    ...(dialect !== undefined && { dialect }),
    ...(options !== undefined && { options }),
  };
};

const parseOutput = (value: unknown, at: string): OutputEntry => {
  if (!isRecord(value)) throw new ManifestError(at, 'expected an object');
  const engine = optionalStr(value.engine, `${at}.engine`);
  const id = optionalStr(value.id, `${at}.id`);
  const inputs = optionalStr(value.inputs, `${at}.inputs`);
  if (value.primary !== undefined && typeof value.primary !== 'boolean')
    throw new ManifestError(`${at}.primary`, 'expected a boolean');
  return {
    model: str(value.model, `${at}.model`),
    path: str(value.path, `${at}.path`),
    ...(engine !== undefined && { engine }),
    ...(id !== undefined && { id }),
    ...(value.primary === true && { primary: true }),
    ...(inputs !== undefined && { inputs }),
  };
};

const parseProjectResources = (
  value: unknown,
  at: string,
): Record<string, string | string[]> => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new ManifestError(at, 'expected an object');
  return Object.fromEntries(
    Object.entries(value).map(([kind, paths]) => [
      kind,
      Array.isArray(paths)
        ? paths.map((path, i) => str(path, `${at}.${kind}[${i}]`))
        : str(paths, `${at}.${kind}`),
    ]),
  );
};

const list = <T>(
  value: unknown,
  at: string,
  item: (value: unknown, at: string) => T,
): T[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ManifestError(at, 'expected an array');
  return value.map((entry, i) => item(entry, `${at}[${i}]`));
};

/** A manifest from its JSON value (project.json); throws a ManifestError naming the bad path. */
export const parseManifest = (value: unknown): Manifest => {
  if (!isRecord(value)) throw new ManifestError('', 'expected an object');
  const dialect = optionalStr(value.dialect, 'dialect');
  const options = parseOptions(value.options, 'options');
  const models = list(value.models, 'models', parseModelEntry);
  const paths = new Set<string>();
  models.forEach(({ path }, i) => {
    if (paths.has(path))
      throw new ManifestError(`models[${i}].path`, `${path} is listed twice`);
    paths.add(path);
  });
  return {
    version: parseVersion(value.version, 'version'),
    ...(dialect !== undefined && { dialect }),
    ...(options !== undefined && { options }),
    models,
    projectResources: parseProjectResources(
      value.projectResources,
      'projectResources',
    ),
    outputs: list(value.outputs, 'outputs', parseOutput),
  };
};

export const isManifest = (value: unknown): value is Manifest => {
  try {
    parseManifest(value);
    return true;
  } catch {
    return false;
  }
};

/** project.json's text: two-space indent, trailing newline, empty lists kept. */
export const serializeManifest = (manifest: Manifest): string =>
  `${JSON.stringify(
    {
      version: manifest.version,
      ...(manifest.dialect !== undefined && { dialect: manifest.dialect }),
      ...(manifest.options !== undefined && { options: manifest.options }),
      models: manifest.models,
      projectResources: manifest.projectResources,
      outputs: manifest.outputs,
    },
    null,
    2,
  )}\n`;

/**
 * The promotion rule: a project needs project.json once it has more than one
 * file (a second model, a project resource or an output); before that its
 * manifest lives in the model itself.
 */
export const needsProjectFile = (manifest: Manifest): boolean =>
  manifest.models.length > 1 ||
  Object.values(manifest.projectResources).some((paths) =>
    Array.isArray(paths) ? paths.length > 0 : true,
  ) ||
  manifest.outputs.length > 0;

/** A one-model manifest. */
export const singleModelManifest = (
  path: string,
  { dialect, options }: { dialect?: string; options?: EngineOptions } = {},
): Manifest => ({
  version: MANIFEST_VERSION,
  ...(dialect !== undefined && { dialect }),
  ...(options !== undefined && Object.keys(options).length > 0 && { options }),
  models: [{ path }],
  projectResources: {},
  outputs: [],
});

// ---------------------------------------------------------------------------
// A model's settings (model entry over project defaults)
// ---------------------------------------------------------------------------

/** What a model is read with: its dialect (null: plain piStar) and engine options. */
export type ManifestSettings = {
  mode: string | null;
  options: EngineOptions;
};

/** A model's settings: its entry's override over the project's default, key by key. */
export const settingsInManifest = (
  manifest: Manifest,
  modelPath?: string,
): ManifestSettings => {
  const entry = modelPath
    ? manifest.models.find((model) => model.path === modelPath)
    : manifest.models.length === 1
      ? manifest.models[0]
      : undefined;
  return {
    mode: entry?.dialect ?? manifest.dialect ?? null,
    options: { ...manifest.options, ...entry?.options },
  };
};

const withoutEmpty = (
  options: EngineOptions | undefined,
): EngineOptions | undefined =>
  options && Object.keys(options).length > 0 ? options : undefined;

/**
 * Set a model's settings: `mode` null clears it (plain piStar), undefined keeps
 * it; `options` replace the ones kept (none: the key goes). A one-model project
 * keeps them at project level (the model and the project are the same); with
 * more models they become the model's override.
 */
export const setSettingsInManifest = (
  manifest: Manifest,
  modelPath: string | undefined,
  settings: { mode?: string | null; options?: EngineOptions },
): Manifest => {
  const shared = manifest.models.length <= 1;
  const assign = <T extends { dialect?: string; options?: EngineOptions }>(
    target: T,
  ): T => {
    const { dialect, options, ...rest } = target;
    const nextDialect =
      settings.mode === undefined ? dialect : (settings.mode ?? undefined);
    const nextOptions =
      settings.options === undefined ? options : withoutEmpty(settings.options);
    return {
      ...rest,
      ...(nextDialect !== undefined && { dialect: nextDialect }),
      ...(nextOptions !== undefined && { options: nextOptions }),
    } as T;
  };
  if (shared) return assign(manifest);
  if (!manifest.models.some((model) => model.path === modelPath))
    throw new ManifestError(
      'models',
      `no model ${modelPath ?? '(none given)'}`,
    );
  return {
    ...manifest,
    models: manifest.models.map((model) =>
      model.path === modelPath ? assign(model) : model,
    ),
  };
};

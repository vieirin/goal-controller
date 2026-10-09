/**
 * The embedded manifest: a one-model project keeps its manifest in the piStar
 * file itself, so opening a bare model needs no migration and saving one never
 * creates a second file.
 *
 * - its dialect is the model's mode record, `diagram.customProperties.engine`
 *   (piStar keeps custom properties, so the record survives the piStar tool);
 *   it is not duplicated into the `project` key;
 * - its options are the top-level `project` key, `{ version, options }`,
 *   written only when there are options (a bare model stays bare).
 *
 * This file is the one place that knows those two paths. Edits are made on
 * the JSON value, in the file's own indentation, key order and trailing
 * newline; a write that changes nothing returns the text as it was.
 */
import {
  ManifestError,
  MANIFEST_VERSION,
  needsProjectFile,
  parseOptions,
  setSettingsInManifest,
  settingsInManifest,
  singleModelManifest,
  type EngineOptions,
  type Manifest,
  type ManifestSettings,
} from './manifest';

/** The top-level key of the embedded manifest. */
export const EMBEDDED_KEY = 'project';

/** Path the model is listed under when the caller doesn't name it. */
const DEFAULT_MODEL_PATH = 'model.txt';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseObject = (text: string): Json => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new ManifestError('', 'a model is a JSON object');
  return value;
};

/** The model's mode record: read and written here only. */
const modeRecord = {
  property: 'engine',
  read(model: Json): string | null {
    const diagram = model.diagram;
    const value =
      isRecord(diagram) && isRecord(diagram.customProperties)
        ? diagram.customProperties[this.property]
        : undefined;
    return typeof value === 'string' && value ? value : null;
  },
  /** whether it changed */
  write(model: Json, mode: string | null): boolean {
    if (this.read(model) === mode) return false;
    if (mode === null) {
      // there is a record (read differs): remove it, keep the rest
      const properties = (model.diagram as Json).customProperties as Json;
      delete properties[this.property];
      return true;
    }
    if (!isRecord(model.diagram)) model.diagram = {};
    const diagram = model.diagram as Json;
    if (!isRecord(diagram.customProperties)) diagram.customProperties = {};
    (diagram.customProperties as Json)[this.property] = mode;
    return true;
  },
};

const readOptions = (model: Json): EngineOptions | undefined => {
  const embedded = model[EMBEDDED_KEY];
  if (embedded === undefined) return undefined;
  if (!isRecord(embedded))
    throw new ManifestError(EMBEDDED_KEY, 'expected an object');
  if (embedded.version !== MANIFEST_VERSION)
    throw new ManifestError(
      `${EMBEDDED_KEY}.version`,
      `unsupported version ${JSON.stringify(embedded.version)} (this workbench reads ${MANIFEST_VERSION})`,
    );
  return parseOptions(embedded.options, `${EMBEDDED_KEY}.options`);
};

/** The mode a model records; null for a plain piStar model or text that isn't a model. */
export const recordedMode = (text: string): string | null => {
  try {
    return modeRecord.read(parseObject(text));
  } catch {
    return null;
  }
};

/**
 * The manifest a model carries: a one-model project whose dialect is the
 * model's mode record and options its `project` key. Throws on JSON that
 * isn't an object, or a `project` key that isn't a manifest.
 */
export const manifestOfModel = (
  text: string,
  path: string = DEFAULT_MODEL_PATH,
): Manifest => {
  const model = parseObject(text);
  const mode = modeRecord.read(model);
  const options = readOptions(model);
  return singleModelManifest(path, {
    ...(mode !== null && { dialect: mode }),
    ...(options !== undefined && { options }),
  });
};

/**
 * The manifest a model carries, for opening it: never throws. A model that
 * isn't JSON (being written, or broken) is `unreadable`, a one-model project
 * with no settings; one whose `project` key isn't a manifest keeps its mode
 * record only. Why is the workbench's to say (it reads the model).
 */
export const readEmbeddedManifest = (
  text: string,
  path: string = DEFAULT_MODEL_PATH,
): { manifest: Manifest; unreadable: boolean } => {
  let model: Json;
  try {
    model = parseObject(text);
  } catch {
    return { manifest: singleModelManifest(path), unreadable: true };
  }
  try {
    return { manifest: manifestOfModel(text, path), unreadable: false };
  } catch {
    const mode = modeRecord.read(model);
    return {
      manifest: singleModelManifest(
        path,
        mode === null ? {} : { dialect: mode },
      ),
      unreadable: false,
    };
  }
};

const detectIndent = (text: string): number | string => {
  const match = /\n([ \t]+)"/.exec(text);
  if (!match || !match[1]) return 0;
  return match[1].includes('\t') ? '\t' : match[1].length;
};

const sameOptions = (
  a: EngineOptions | undefined,
  b: EngineOptions | undefined,
): boolean => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/**
 * Write a one-model manifest into the model text. Throws when the manifest
 * needs project.json (more than one file): such a project is promoted instead.
 */
export const withEmbeddedManifest = (
  text: string,
  manifest: Manifest,
): string => {
  if (needsProjectFile(manifest))
    throw new ManifestError(
      '',
      'this project has more than one file: its manifest is project.json',
    );
  const model = parseObject(text);
  const { mode, options } = settingsInManifest(manifest);
  let changed = modeRecord.write(model, mode);
  const kept = readOptions(model);
  const next = Object.keys(options).length > 0 ? options : undefined;
  if (!sameOptions(kept, next)) {
    changed = true;
    if (next === undefined) delete model[EMBEDDED_KEY];
    else model[EMBEDDED_KEY] = { version: MANIFEST_VERSION, options: next };
  }
  if (!changed) return text;
  const indent = detectIndent(text);
  return (
    JSON.stringify(model, null, indent === 0 ? undefined : indent) +
    (text.endsWith('\n') ? '\n' : '')
  );
};

/** A model's settings as its own text records them. */
export const modelSettingsOf = (text: string): ManifestSettings =>
  settingsInManifest(manifestOfModel(text));

/**
 * The model text with its settings written: `mode` null records plain piStar
 * (no record), undefined keeps the record; `options` replace the kept ones
 * (empty: the `project` key goes). Only what changes is rewritten.
 */
export const withModelSettings = (
  text: string,
  settings: { mode?: string | null; options?: EngineOptions },
): string =>
  withEmbeddedManifest(
    text,
    setSettingsInManifest(manifestOfModel(text), undefined, settings),
  );

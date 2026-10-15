/**
 * A model's native files (goal-controller#143): the same model in its
 * dialect's own format, beside its piStar file, kept 1:1 with it. The
 * manifest lists each by the dialect's native file id (`models[].native`);
 * one it doesn't list is found at the model's name with the format's
 * extension. Reading and writing are the dialect's (its definition, as
 * data passed in); this module says where the files are, whether one
 * still reads to the model, and what opening one makes.
 *
 * The sync rule: a native file is in sync when it reads to the model but
 * for what its format can't carry (`lossy`). With a writer, the file
 * follows the model (the workbench writes it after each edit); without
 * one, the file is edited and the model re-imported from it. A file that
 * isn't in sync when the project opens is said, with two ways out:
 * regenerate it from the model, or re-import the model from it. No merge.
 */
import {
  firstError,
  jsonText,
  modelDifference,
  type NativeDiagnostic,
  type NativeFileContext,
  type NativeFileDefinition,
  type NativeReadResult,
  type NativeWriteResult,
} from '@goal-controller/dialect';
import { EMBEDDED_KEY } from './embedded';
import {
  MANIFEST_VERSION,
  PROJECT_FILE,
  serializeManifest,
  type Manifest,
} from './manifest';

/** The native files a dialect declares, by id (its definition's `nativeFiles`). */
export type NativeDeclarations = Readonly<Record<string, NativeFileDefinition>>;

export type NativeSlot = {
  /** the model it is the native file of */
  model: string;
  /** the dialect's native file id */
  id: string;
  definition: NativeFileDefinition;
  /** where it is, or would be (a missing one isn't made: its project has none) */
  path: string;
  /** where it was found: the manifest's entry, the model's name with the extension, or nowhere */
  from: 'manifest' | 'default' | null;
  missing: boolean;
};

/** A path without its last extension (`lab/home.txt` → `lab/home`). */
const stem = (path: string): string => path.replace(/\.[^./]*$/, '');

/**
 * Each model's native files in a project of these files, for the native
 * files its dialect declares: where the manifest says, or at the model's
 * name with one of the format's extensions, or missing (at its first).
 */
export const nativeSlots = (
  manifest: Manifest,
  files: readonly string[],
  models: readonly string[],
  declarations: NativeDeclarations,
): NativeSlot[] =>
  models.flatMap((model) => {
    const entry = manifest.models.find((m) => m.path === model);
    return Object.entries(declarations).map(([id, definition]) => {
      const listed = entry?.native?.[id];
      if (listed !== undefined)
        return {
          model,
          id,
          definition,
          path: listed,
          from: 'manifest' as const,
          missing: !files.includes(listed),
        };
      const found = definition.extensions
        .map((extension) => `${stem(model)}${extension}`)
        .find((path) => files.includes(path));
      return {
        model,
        id,
        definition,
        path: found ?? `${stem(model)}${definition.extensions[0] ?? ''}`,
        from: found ? ('default' as const) : null,
        missing: !found,
      };
    });
  });

/** Whether a native file reads to the model, and if not, where they differ. */
export type NativeSync =
  | { state: 'in-sync'; diagnostics: NativeDiagnostic[] }
  | {
      state: 'out-of-sync' | 'unreadable';
      /** what differs, or why the file doesn't read */
      why: string;
      diagnostics: NativeDiagnostic[];
    };

/** What the workbench keeps in a model's file that is no model's (its embedded manifest). */
const WORKBENCH_PATHS = [EMBEDDED_KEY];

/** A model's text as the piStar JSON a native file is compared with and written from. */
const modelOf = (modelText: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(modelText);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * Whether a native file is in sync with the model: it reads, and to the
 * model but for its format's lossy paths (and the workbench's own keys).
 */
export const nativeSync = (
  definition: NativeFileDefinition,
  nativeText: string,
  modelText: string,
  context: NativeFileContext,
): NativeSync => {
  const read = definition.read(nativeText, context);
  if (!read.model)
    return {
      state: 'unreadable',
      why: firstError(read.diagnostics),
      diagnostics: read.diagnostics,
    };
  const model = modelOf(modelText);
  if (!model)
    return {
      state: 'out-of-sync',
      why: 'the model is not piStar JSON',
      diagnostics: read.diagnostics,
    };
  const difference = modelDifference(model, read.model, [
    ...(definition.lossy ?? []),
    ...WORKBENCH_PATHS,
  ]);
  return difference
    ? {
        state: 'out-of-sync',
        why: `${difference.path} is ${difference.b} in the file, ${difference.a} in the model`,
        diagnostics: read.diagnostics,
      }
    : { state: 'in-sync', diagnostics: read.diagnostics };
};

/** The model written in the native format: none, with why, when it can't be. */
export const writeNative = (
  definition: NativeFileDefinition,
  modelText: string,
  context: NativeFileContext,
): NativeWriteResult => {
  if (!definition.write)
    return {
      text: null,
      diagnostics: [
        { severity: 'error', message: `${definition.label} is read only` },
      ],
    };
  const model = modelOf(modelText);
  if (!model)
    return {
      text: null,
      diagnostics: [
        { severity: 'error', message: 'the model is not piStar JSON' },
      ],
    };
  // the model as the format has it: not the workbench's own keys
  const { [EMBEDDED_KEY]: _manifest, ...piStar } = model;
  return definition.write(piStar, context);
};

/** A model as its piStar file's text. */
export const modelText = (model: Record<string, unknown>): string =>
  jsonText(model);

/**
 * A native file opened: the project it makes, as files (path → text). Its
 * model beside it (`<name>.txt`, as the workbench names a model), the
 * native file as it was, the project resources the reader gave, and the
 * project.json listing them with the dialect and its options.
 */
export const nativeProjectFiles = (
  fileName: string,
  text: string,
  native: { id: string; baseName: string },
  read: Extract<NativeReadResult, { model: Record<string, unknown> }>,
): { files: Record<string, string>; manifest: Manifest; model: string } => {
  const model = `${native.baseName}.txt`;
  const { engine, projectResources, options } = read.dialectRecord;
  const resources = Object.entries(projectResources).filter(
    ([, files]) => Object.keys(files).length > 0,
  );
  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    dialect: engine,
    ...(options && Object.keys(options).length > 0 && { options }),
    models: [{ path: model, native: { [native.id]: fileName } }],
    projectResources: Object.fromEntries(
      resources.map(([kind, files]) => {
        const paths = Object.keys(files).sort();
        return [kind, paths.length === 1 ? paths[0]! : paths];
      }),
    ),
    outputs: [],
  };
  return {
    model,
    manifest,
    files: {
      [model]: modelText(read.model),
      [fileName]: text,
      ...Object.fromEntries(
        resources.flatMap(([, files]) => Object.entries(files)),
      ),
      [PROJECT_FILE]: serializeManifest(manifest),
    },
  };
};

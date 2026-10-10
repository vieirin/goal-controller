/**
 * A run's output files in the workbench (goal-controller#33): which one is
 * shown, traced, compared and read back, and how they are downloaded.
 * React-free (the dialect tests run it).
 */
import { strToU8, zipSync } from 'fflate';
import type { EngineOutputFile } from '@goal-controller/lib';
import { baseName, downloadBytes, downloadText } from './download';
import { buildTraceIndex, type TraceIndex } from './trace';

export type OutputFile = EngineOutputFile;

/** What the helpers read of a run. */
type RunFiles = { engine: string; files: readonly OutputFile[] | null };

/** A run's provenance: what it was generated from, or, read from a project, that hashed. */
type RunInputs = { signature: string; inputs?: string };

/**
 * Whether a run was generated from these inputs (a signature): its own
 * signature, or, for a run read from a project, its inputs' hash. A run read
 * from entries written before #33 (no hash) is never current.
 */
export const generatedFrom = (
  run: RunInputs,
  signature: string | null,
): boolean =>
  signature !== null &&
  (run.inputs !== undefined
    ? run.inputs === inputsHash(signature)
    : run.signature === signature);

/**
 * A run of a project's saved outputs (readOutputs): shown until the first
 * generation, current while its inputs' hash matches, and what an Edge
 * engine reads as previousOutput.
 */
export const savedRun = <E extends string>(
  saved: { files: readonly OutputFile[]; inputs?: string },
  { id, engine, at }: { id: number; engine: E; at: number },
) => ({
  id,
  at,
  engine,
  durationMs: 0,
  signature: '',
  files: [...saved.files],
  report: null,
  error: null,
  // none kept (written before #33): never what the model is now
  inputs: saved.inputs ?? '',
});

/** What saveOutputs keeps of a run in its project: its files, its engine, its inputs hashed. */
export const outputsToSave = (
  run: RunFiles & RunInputs,
  model: string,
): {
  model: string;
  engine: string;
  files: readonly OutputFile[];
  inputs: string;
} | null =>
  run.files
    ? {
        model,
        engine: run.engine,
        files: run.files,
        inputs: run.inputs ?? inputsHash(run.signature),
      }
    : null;

/** The primary file (an engine marks exactly one; the first stands in otherwise). */
export const primaryOf = (
  files: readonly OutputFile[],
): OutputFile | undefined => files.find((file) => file.primary) ?? files[0];

/** The latest run that produced files (a failed run keeps the previous output showing). */
export const lastGoodRun = <R extends RunFiles>(runs: readonly R[]): R | null =>
  runs.find((run) => run.files !== null) ?? null;

/**
 * What the workbench shows for an engine, from the runs of every engine
 * (latest first): its latest run, and its latest that produced files.
 * Another engine's runs are kept for when it is chosen again, never shown
 * for this one.
 */
export const engineRuns = <R extends RunFiles>(
  runs: readonly R[],
  engine: string,
): { runs: R[]; current: R | null; lastGood: R | null } => {
  const own = runs.filter((run) => run.engine === engine);
  return { runs: own, current: own[0] ?? null, lastGood: lastGoodRun(own) };
};

/**
 * The runs with a project's saved run of an engine (savedRun) first, unless
 * that engine has run already; the other engines' runs stay.
 */
export const withSavedRun = <R extends RunFiles>(
  runs: readonly R[],
  saved: R,
): readonly R[] =>
  runs.some((run) => run.engine === saved.engine) ? runs : [saved, ...runs];

/**
 * What an Edge engine reads as `previousOutput`: the primary file of the
 * latest run of that engine that produced files.
 */
export const previousOutputOf = (
  runs: readonly RunFiles[],
  engine: string,
): string | undefined => {
  const run = runs.find((r) => r.engine === engine && r.files !== null);
  return run?.files ? primaryOf(run.files)?.text : undefined;
};

/** The file a tab shows: the one with this id, else the primary. */
export const activeFileOf = (
  files: readonly OutputFile[],
  id: string | null,
): OutputFile | undefined =>
  files.find((file) => file.id === id) ?? primaryOf(files);

/**
 * One tab per file, in the engine's order: a single file is labelled with
 * what the engine generates (`PRISM`, as before), several by their names.
 */
export const outputFileTabs = (
  files: readonly OutputFile[],
  label: string,
): Array<{ id: string; label: string }> =>
  files.length === 1
    ? [{ id: files[0]!.id, label }]
    : files.map((file) => ({ id: file.id, label: file.fileName }));

/**
 * A file's trace to the model: the lines' owners its engine gives, else, for
 * the primary file, the node ids its identifiers embed (buildTraceIndex);
 * null for any other file (plain text). An owner may be an element's piStar
 * id (an engine whose ids repeat, GODA's): `keyOf` gives the view's key.
 */
export const traceOfFile = (
  file: OutputFile,
  nodeIds: Iterable<string>,
  keyOf: (owner: string) => string = (owner) => owner,
): TraceIndex | null => {
  if (file.owners)
    return {
      lines: file.owners.map((ids) => ({
        primary: ids.map(keyOf),
        mentions: [],
      })),
      outline: [],
    };
  return file.primary ? buildTraceIndex(file.text, nodeIds) : null;
};

/** "Download all": every file, zipped in a folder named after the model. */
export const outputArchive = (
  files: readonly OutputFile[],
  modelName: string,
): { fileName: string; bytes: Uint8Array } => {
  const folder = `${baseName(modelName)}-output`;
  return {
    fileName: `${folder}.zip`,
    bytes: zipSync(
      Object.fromEntries(
        files.map((file) => [`${folder}/${file.fileName}`, strToU8(file.text)]),
      ),
    ),
  };
};

/** Download one file as it is. */
export const downloadFile = (file: OutputFile): void =>
  downloadText(file.fileName, file.text);

/** Download a run's output: its one file as it is, several as a zip (outputArchive). */
export const downloadOutput = (
  files: readonly OutputFile[],
  modelName: string,
): void => {
  const [only] = files;
  if (only && files.length === 1) return downloadFile(only);
  const { fileName, bytes } = outputArchive(files, modelName);
  downloadBytes(fileName, bytes);
};

/** What downloadOutput gives: the one file's extension (`prism`), else `zip`. */
export const outputDownloadExtension = (
  files: readonly OutputFile[],
): string => {
  const [only] = files;
  return only && files.length === 1
    ? (/\.([^./]+)$/.exec(only.fileName)?.[1] ?? '')
    : 'zip';
};

/**
 * A short, stable hash of what a run was generated from (its signature),
 * kept with a project's outputs: another value when the project is opened
 * again means the model changed since (cyrb53).
 */
export const inputsHash = (signature: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < signature.length; i += 1) {
    const ch = signature.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

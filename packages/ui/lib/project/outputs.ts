/**
 * What an engine produced from a model, kept in its project (goal-controller#33):
 * one file under `out/` and one manifest entry per file the engine returned.
 * The files are text; what they mean is the engine's.
 */
import {
  PROJECT_FILE,
  serializeManifest,
  type Manifest,
  type OutputEntry,
} from './manifest';
import { promote, type Project } from './open';
import { normalizePath } from './store';

/** A file an engine produced (the shape of the engines' EngineOutputFile this module reads). */
export type ProducedFile = {
  id: string;
  fileName: string;
  text: string;
  primary?: boolean;
};

/** A model's outputs of one engine. */
export type ProducedOutputs = {
  model: string;
  engine: string;
  files: readonly ProducedFile[];
  /** what they were generated from, hashed (OutputEntry.inputs) */
  inputs?: string;
};

/** Where a produced file is kept: `out/<its file name>`. */
export const outputPath = (file: Pick<ProducedFile, 'fileName'>): string =>
  normalizePath(`out/${file.fileName}`);

/**
 * The project with a run's files as its outputs (not written): each file at
 * `out/<file name>` with an entry naming the model, the engine and the file's
 * id. They replace that model's earlier entries for the engine (and any
 * entry at the same path), so regenerating never piles up entries. A
 * one-model project is promoted. Returns the files to write: saveProject, or
 * copyProject to a store that can be written. A file an earlier run made
 * that this one doesn't is no longer listed; it stays in the store.
 */
export const withOutputs = (
  from: Project,
  { model, engine, files, inputs }: ProducedOutputs,
): { project: Project; changes: Record<string, string> } => {
  const { project: promoted, changes } = promote(from);
  const entries: OutputEntry[] = files.map((file) => ({
    model,
    path: outputPath(file),
    engine,
    id: file.id,
    ...(file.primary && { primary: true }),
    ...(inputs !== undefined && { inputs }),
  }));
  const paths = new Set(entries.map((entry) => entry.path));
  const manifest: Manifest = {
    ...promoted.manifest,
    outputs: [
      ...promoted.manifest.outputs.filter(
        (entry) =>
          !(entry.model === model && entry.engine === engine) &&
          !paths.has(entry.path),
      ),
      ...entries,
    ],
  };
  return {
    project: {
      ...promoted,
      manifest,
      outputs: manifest.outputs,
      files: [...new Set([...promoted.files, ...paths, PROJECT_FILE])].sort(),
    },
    changes: {
      ...changes,
      ...Object.fromEntries(files.map((file) => [outputPath(file), file.text])),
      [PROJECT_FILE]: serializeManifest(manifest),
    },
  };
};

/**
 * A model's outputs of one engine as the project keeps them, in the
 * manifest's order; null when none of their files is there (not generated
 * yet). A listed file that is missing is left out. Entries that name no
 * primary file (written before #33) take the first as primary.
 */
export const readOutputs = async (
  project: Project,
  model: string,
  engine: string,
): Promise<ProducedOutputs | null> => {
  const entries = project.outputs.filter(
    (entry) => entry.model === model && entry.engine === engine,
  );
  const present = entries.filter((entry) => project.files.includes(entry.path));
  if (present.length === 0) return null;
  const primary = Math.max(
    present.findIndex((entry) => entry.primary),
    0,
  );
  const files = await Promise.all(
    present.map(async (entry, i) => ({
      id: entry.id ?? entry.path,
      fileName: entry.path.replace(/^out\//, ''),
      text: await project.store.read(entry.path),
      ...(i === primary && { primary: true }),
    })),
  );
  const { inputs } = present[primary]!;
  return { model, engine, files, ...(inputs !== undefined && { inputs }) };
};

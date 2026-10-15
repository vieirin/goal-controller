/**
 * The importers the workbench opens a file with, by its extension: another
 * tool's model, read into a piStar model in one of our dialects
 * (packages/dialect/docs/importers.md). An importer whose dialect reads a
 * project resource beside the model (`.jucm`'s strategies) needs a project
 * to open into, so it isn't listed here yet.
 */
import type { ImportResult } from './types';

export type FileImporter = {
  /** shown to people: the source's format */
  label: string;
  /** the extensions it reads, lower case, with their dot */
  extensions: readonly string[];
  /** the engine the model it writes is for */
  engine: string;
  import: (text: string, options: { modelName: string }) => ImportResult;
};

// iStarDT-X and TAOM4E's .tropos are their dialects' native files now
// (nativeFiles, goal-controller#143/#144); none is an importer alone
export const FILE_IMPORTERS: readonly FileImporter[] = [];

/** The importer a file's name says it is for, and the name without its extension. */
export const importerFor = (
  fileName: string,
): { importer: FileImporter; baseName: string } | null => {
  const lower = fileName.toLowerCase();
  for (const importer of FILE_IMPORTERS)
    for (const extension of importer.extensions)
      if (lower.endsWith(extension))
        return {
          importer,
          baseName: fileName.slice(0, fileName.length - extension.length),
        };
  return null;
};

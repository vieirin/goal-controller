import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { EngineOutput } from '../engines/output';

/**
 * Writes every file of an engine's output into `directory`, by its file
 * name; returns the paths written, the primary file's first.
 *
 * Only `fs`, like `previousOutput.ts`: `src/index.ts` imports this for the
 * CLI and is also the library entry the UI bundles.
 */
export const writeOutputFiles = (
  directory: string,
  output: EngineOutput,
): string[] => {
  mkdirSync(directory, { recursive: true });
  return [...output.files]
    .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
    .map((file) => {
      const target = path.join(directory, file.fileName);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.text);
      return target;
    });
};

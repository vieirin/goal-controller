import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'fs';
import path from 'path';
import { outputPathProblems, type EngineOutput } from '../engines/output';

/** Whether `target` exists and is a symbolic link (not followed). */
const isLink = (target: string): boolean => {
  try {
    return lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Writes every file of an engine's output into `directory`, by its file
 * name; returns the paths written, the primary file's first.
 *
 * It writes nothing when a file can't be written where its name says: a name
 * outside the directory, two files at one path, a file another file needs as
 * a directory (`outputPathProblems`), or a path through a symbolic link
 * already in the directory (the file, or a directory on its way), which
 * would take the write elsewhere.
 *
 * Only `fs`, like `previousOutput.ts`: `src/index.ts` imports this for the
 * CLI and is also the library entry the UI bundles.
 */
export const writeOutputFiles = (
  directory: string,
  output: EngineOutput,
): string[] => {
  const problems = outputPathProblems(output);
  if (problems.length) throw new Error(problems.join('; '));
  mkdirSync(directory, { recursive: true });
  const root = realpathSync(directory);
  const targets = output.files.map((file) => {
    const parts = file.fileName.split('/');
    for (let i = 1; i <= parts.length; i++)
      if (isLink(path.join(root, ...parts.slice(0, i))))
        throw new Error(
          `${parts.slice(0, i).join('/')} is a symbolic link in ${directory}: ${file.fileName} is not written through it`,
        );
    return { file, target: path.join(root, ...parts) };
  });
  return targets
    .sort((a, b) => Number(!!b.file.primary) - Number(!!a.file.primary))
    .map(({ file, target }) => {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.text);
      return path.join(directory, file.fileName);
    });
};

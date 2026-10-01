import { existsSync, readFileSync } from 'fs';

/**
 * Reads a previous PRISM output for `baseName`, if one exists.
 * Supports both monorepo and direct execution.
 *
 * Kept in its own module (only `fs`, no `fs/promises`): `src/index.ts`
 * imports this for the CLI, and is also the library entry the UI bundles
 * for the browser, which can't resolve `fs/promises`.
 */
export const readPreviousOutput = (baseName: string): string | undefined => {
  const possiblePaths = [
    `output/${baseName}.prism`, // From project root
    `../../output/${baseName}.prism`, // From packages/lib (monorepo)
  ];
  const oldPrismFilePath = possiblePaths.find((p) => existsSync(p));
  return oldPrismFilePath ? readFileSync(oldPrismFilePath, 'utf8') : undefined;
};

import { existsSync } from 'fs';
import { basename, join } from 'path';

export const getVariablesFilePath = (modelPath: string): string => {
  const fileName = basename(modelPath, '.txt'); // Remove extension if present
  const relativePath = join('input', fileName, 'variables.json');

  // Try multiple paths to support both direct execution and monorepo (from packages/lib)
  if (existsSync(relativePath)) {
    return relativePath;
  }
  const monorepoPath = join('..', '..', 'input', fileName, 'variables.json');
  if (existsSync(monorepoPath)) {
    return monorepoPath;
  }

  // Return the default path (will fail with helpful error if file doesn't exist)
  return relativePath;
};


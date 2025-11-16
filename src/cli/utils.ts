import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';

const LAST_SELECTED_DB = 'lastSelected.db';

export const getFilesInDirectory = async (
  directory: string,
): Promise<Array<{ name: string; path: string; mtime: Date }>> => {
  try {
    const files = await readdir(directory);
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = join(directory, file);
        const stats = await stat(filePath);

        // If it's a directory, recursively get files from it
        if (stats.isDirectory()) {
          return await getFilesInDirectory(filePath);
        }

        // If it's a file and ends with .txt, return it
        if (file.endsWith('.txt')) {
          return [
            {
              name: file,
              path: filePath,
              mtime: stats.mtime,
            },
          ];
        }

        // Otherwise, return empty array
        return [];
      }),
    );

    // Flatten the array of arrays and sort by modification time
    const allFiles = fileStats.flat();
    return allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

export const saveLastSelectedModel = async (
  filePath: string,
): Promise<void> => {
  try {
    await writeFile(LAST_SELECTED_DB, filePath);
    console.log(`Last selected model saved to ${LAST_SELECTED_DB}`);
  } catch (error) {
    console.error('Error saving last selected model:', error);
  }
};

export const getLastSelectedModel = async (): Promise<string | null> => {
  try {
    const data = await readFile(LAST_SELECTED_DB, 'utf-8');
    return data.trim();
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
};

import type { ProjectSource, ProjectStore } from '../store';

/**
 * Files in memory (path → text), written in place: a project made where the
 * browser has no private file system to keep it in (a native file opened,
 * goal-controller#143). Gone when the page is.
 */
export const memoryStore = (
  files: Readonly<Record<string, string>>,
  source: ProjectSource,
): ProjectStore => {
  const texts = new Map(Object.entries(files));
  return {
    source,
    readOnly: false,
    list: async () => [...texts.keys()].sort(),
    read: async (path) => {
      const text = texts.get(path);
      if (text === undefined) throw new Error(`${path}: not in this project`);
      return text;
    },
    write: async (path, text) => {
      texts.set(path, text);
    },
  };
};

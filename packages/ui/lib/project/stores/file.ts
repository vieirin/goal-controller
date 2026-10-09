import type { ProjectStore } from '../store';

/**
 * A single file, in memory: the implicit one-model project. Writes go back to
 * the caller (the workbench downloads them, as it always did); without
 * `onWrite` the store is read-only.
 */
export const fileStore = (
  name: string,
  text: string,
  onWrite?: (name: string, text: string) => void | Promise<void>,
): ProjectStore => {
  let current = text;
  return {
    source: { kind: 'file', name },
    readOnly: !onWrite,
    form: 'embedded',
    list: async () => [name],
    read: async (path) => {
      if (path !== name) throw new Error(`${path}: not in this project`);
      return current;
    },
    write: async (path, next) => {
      if (!onWrite || path !== name)
        throw new Error(`${path}: a single-file project only writes ${name}`);
      await onWrite(name, next);
      current = next;
    },
  };
};

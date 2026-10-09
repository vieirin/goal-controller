import type { ProjectSource, ProjectStore } from '../store';

/**
 * A single file, in memory: the implicit one-model project. Writes go back to
 * the caller (the workbench downloads them, as it always did); without
 * `onWrite` the store is read-only. `source` says where the file came from
 * when it isn't a local file of that name (a Recent entry of an example).
 */
export const fileStore = (
  name: string,
  text: string,
  {
    onWrite,
    source = { kind: 'file', name },
  }: {
    onWrite?: (name: string, text: string) => void | Promise<void>;
    source?: ProjectSource;
  } = {},
): ProjectStore => {
  let current = text;
  return {
    source,
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

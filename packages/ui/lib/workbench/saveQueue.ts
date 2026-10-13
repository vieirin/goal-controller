/**
 * Saves run after a pause in the edits, one timer per file: an edit of
 * several files at once (a rename across them) saves every one, where a
 * single timer kept only the last file's save.
 */
export type SaveQueue = {
  /** run `save` once `key`'s edits pause (a later call for the same key replaces it) */
  schedule(key: string, save: () => void): void;
};

export const saveQueue = (delay = 500): SaveQueue => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    schedule: (key, save) => {
      clearTimeout(timers.get(key));
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          save();
        }, delay),
      );
    },
  };
};

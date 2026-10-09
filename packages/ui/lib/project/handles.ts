/**
 * Where the folders a user opened are kept between visits: their handles,
 * by key (a directory source's `key`), so Recent can reopen them. Behind a
 * port like Recent's storage: the browser's IndexedDB (handles can't go in
 * localStorage), opened only when used; a map in tests.
 */
import { directoryStore, type DirectoryHandleLike } from './stores/directory';
import type { ProjectSource, ProjectStore } from './store';

export interface HandleStorage {
  get(key: string): Promise<DirectoryHandleLike | undefined>;
  set(key: string, handle: DirectoryHandleLike): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Handles in memory (tests, or a browser without IndexedDB). */
export const memoryHandles = (): HandleStorage => {
  const handles = new Map<string, DirectoryHandleLike>();
  return {
    get: async (key) => handles.get(key),
    set: async (key, handle) => void handles.set(key, handle),
    delete: async (key) => void handles.delete(key),
  };
};

const STORE = 'handles';

/** Handles in the browser's IndexedDB, under `database`. */
export const indexedDbHandles = (
  database = 'goal-workbench:handles',
): HandleStorage => {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('this browser keeps no folders (no IndexedDB)'));
        return;
      }
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> => {
    const store = (await db()).transaction(STORE, mode).objectStore(STORE);
    return new Promise<T>((resolve, reject) => {
      const request = action(store);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    get: (key) => run('readonly', (store) => store.get(key)),
    set: async (key, handle) => {
      await run('readwrite', (store) => store.put(handle, key));
    },
    delete: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    },
  };
};

/** Keep a folder the user opened; its store, by a new key. */
export const rememberDirectory = async (
  handles: HandleStorage,
  handle: DirectoryHandleLike,
  key: string = `${handle.name}:${Date.now().toString(36)}`,
): Promise<ProjectStore> => {
  await handles.set(key, handle);
  return directoryStore(handle, key);
};

/**
 * The store of a folder kept before (a Recent entry's source); null when its
 * handle is gone (the browser forgot it, or it was another browser's).
 */
export const reopenDirectory = async (
  handles: HandleStorage,
  source: Extract<ProjectSource, { kind: 'directory' }>,
): Promise<ProjectStore | null> => {
  const handle = await handles.get(source.key);
  return handle ? directoryStore(handle, source.key) : null;
};

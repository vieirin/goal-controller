/** Fakes of what the project module's stores and Recent use: a folder's handles, a storage. */
import type {
  DirectoryHandleLike,
  FileHandleLike,
  RecentStorage,
} from '../../../../ui/lib/project';

/** An in-memory folder with the handles' methods a store uses. */
export type Tree = { [name: string]: string | Tree };
export const fakeDirectory = (
  name: string,
  tree: Tree,
): DirectoryHandleLike => ({
  kind: 'directory',
  name,
  async *values() {
    for (const [child, value] of Object.entries(tree))
      yield typeof value === 'string'
        ? fakeFile(tree, child)
        : fakeDirectory(child, value);
  },
  async getDirectoryHandle(child, options) {
    if (typeof tree[child] !== 'object') {
      if (!options?.create || child in tree)
        throw new Error(`NotFoundError: ${child}`);
      tree[child] = {};
    }
    return fakeDirectory(child, tree[child] as Tree);
  },
  async getFileHandle(child, options) {
    if (typeof tree[child] !== 'string') {
      if (!options?.create || child in tree)
        throw new Error(`NotFoundError: ${child}`);
      tree[child] = '';
    }
    return fakeFile(tree, child);
  },
});
const fakeFile = (tree: Tree, name: string): FileHandleLike => ({
  kind: 'file',
  name,
  getFile: async () => ({ text: async () => tree[name] as string }),
  createWritable: async () => {
    let data = '';
    return {
      write: async (chunk: string) => {
        data += chunk;
      },
      close: async () => {
        tree[name] = data;
      },
    };
  },
});

export const fakeStorage = (): RecentStorage & {
  data: Map<string, string>;
} => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
};

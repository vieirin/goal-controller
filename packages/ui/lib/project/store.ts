/**
 * Where a project's files are: one interface over every storage layer (a
 * single file, a folder on disk, the browser's private file system, a GitHub
 * folder). Paths are POSIX, relative to the project's root.
 */

/** Where a project came from, serialisable (Recent keeps it). */
export type ProjectSource =
  | { kind: 'file'; name: string }
  /** a folder opened with the File System Access API; its handle is kept by `key` */
  | { kind: 'directory'; key: string; name: string }
  | { kind: 'opfs'; name: string }
  | { kind: 'github'; repo: string; ref: string; path: string };

/** How the project keeps its manifest: in its one model, or in project.json. */
export type ManifestForm = 'embedded' | 'file';

export interface ProjectStore {
  readonly source: ProjectSource;
  readonly readOnly: boolean;
  /**
   * Known in advance (the deploy-time index): openProject reads the manifest
   * from there without looking for one elsewhere.
   */
  readonly form?: ManifestForm;
  /** every file, POSIX paths from the root */
  list(): Promise<string[]>;
  read(path: string): Promise<string>;
  /** throws on a read-only store */
  write(path: string, text: string): Promise<void>;
}

export class ReadOnlyStoreError extends Error {
  constructor(source: ProjectSource) {
    super(`${sourceLabel(source)} is read-only`);
    this.name = 'ReadOnlyStoreError';
  }
}

export const sourceLabel = (source: ProjectSource): string => {
  switch (source.kind) {
    case 'file':
    case 'directory':
    case 'opfs':
      return source.name;
    case 'github':
      return `${source.repo}/${source.path}@${source.ref}`;
  }
};

/** a/b/../c → a/c; refuses paths that leave the root */
export const normalizePath = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) throw new Error(`${path} is outside the project`);
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
};

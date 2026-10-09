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
  /** in the browser's private file system; `copyOf`: the project it is a copy of */
  | { kind: 'opfs'; name: string; copyOf?: ProjectSource }
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

/**
 * A project in the deploy-time index of a GitHub folder (examples/), built by
 * scripts/examples-manifest.mjs: enough to open it with githubStore without
 * listing anything over the network.
 */
export type ProjectIndexEntry = {
  /** the entry's id: a loose model's path, or a project folder's, from the indexed root */
  path: string;
  group: string;
  name: string;
  form: ManifestForm;
  /** a project.json's dialect (an implicit project's is its folder's: the workbench knows) */
  dialect?: string;
  /** the project's folder, from the indexed root */
  root: string;
  /** every file of the project, from its folder */
  files: string[];
  models: string[];
  projectResources: Record<string, string | string[]>;
  outputs: string[];
};

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
      return source.name;
    case 'opfs':
      return source.copyOf
        ? `${source.name} (browser copy of ${sourceLabel(source.copyOf)})`
        : `${source.name} (in this browser)`;
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

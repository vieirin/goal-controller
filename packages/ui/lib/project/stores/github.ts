import {
  normalizePath,
  ReadOnlyStoreError,
  type ManifestForm,
  type ProjectStore,
} from '../store';

type Fetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export const EXAMPLES_REPO = 'vieirin/goal-controller';

/**
 * A folder of a public GitHub repository, read-only. Its files come from the
 * deploy-time index, so nothing is listed over the network: opening a project
 * fetches the files it reads, one request each.
 */
export const githubStore = ({
  repo = EXAMPLES_REPO,
  ref,
  path,
  files,
  form,
  fetch: get = (url) => fetch(url),
}: {
  repo?: string;
  ref: string;
  /** the project's folder in the repository */
  path: string;
  /** the project's files, from its folder */
  files: readonly string[];
  form?: ManifestForm;
  fetch?: Fetch;
}): ProjectStore => {
  const root = normalizePath(path);
  const source = { kind: 'github', repo, ref, path: root } as const;
  return {
    source,
    readOnly: true,
    ...(form && { form }),
    list: async () => [...files],
    read: async (file) => {
      const full = [root, normalizePath(file)].filter(Boolean).join('/');
      const response = await get(
        `https://raw.githubusercontent.com/${repo}/${ref}/${full
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      );
      if (!response.ok) {
        // the index lists local files; one added or renamed locally and not yet
        // pushed to ref isn't on GitHub yet
        throw new Error(
          `Couldn't load ${full}: ${response.status} ${response.statusText} (not pushed to ${ref}?)`,
        );
      }
      return response.text();
    },
    write: async () => {
      throw new ReadOnlyStoreError(source);
    },
  };
};

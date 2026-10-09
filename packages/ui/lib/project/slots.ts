/**
 * A project's resources, by what its dialect declares (goal-controller#25):
 * each kind is in the project where its manifest says, or at the
 * declaration's default path, or missing. Missing is not an error: a project
 * without its world is a model alone, as before.
 */
import type { ProjectResourceDefinition } from '@goal-controller/dialect';
import { PROJECT_FILE, type Manifest } from './manifest';

/** The project resources a dialect reads, by kind (its definition's `projectResources`). */
export type ProjectResourceDeclarations = Readonly<
  Record<string, ProjectResourceDefinition>
>;

export type ResourceSlot = {
  kind: string;
  definition: ProjectResourceDefinition;
  /** its files in the project (several for a `many` kind) */
  paths: string[];
  /** where they were found: the manifest's entry, or the declaration's default path */
  from: 'manifest' | 'default' | null;
  /** files the manifest lists that the project doesn't have */
  absent: string[];
  /** no file: the kind is missing */
  missing: boolean;
  /** whether the dialect declares it (else the manifest lists it, and nobody reads it) */
  declared: boolean;
};

/** Whether a file is one a kind takes, by its declared extensions. */
export const accepts = (
  definition: ProjectResourceDefinition,
  path: string,
): boolean =>
  !definition.accept?.length ||
  definition.accept.some((extension) =>
    path.toLowerCase().endsWith(extension.toLowerCase()),
  );

/** the files under a folder path (`props/`) a kind takes */
const under = (
  definition: ProjectResourceDefinition,
  folder: string,
  files: readonly string[],
): string[] =>
  files
    .filter((file) => file.startsWith(folder) && accepts(definition, file))
    .sort();

/** A file's format, by its extension (a kind no dialect declares has only that). */
export const formatOf = (path: string): ProjectResourceDefinition['format'] => {
  const extension = /\.([^./]+)$/.exec(path.toLowerCase())?.[1] ?? '';
  if (['xml', 'jucm', 'sts'].includes(extension)) return 'xml';
  if (extension === 'json') return 'json';
  if (extension === 'hddl' || extension === 'pddl') return 'hddl';
  if (extension === 'pctl' || extension === 'props') return 'pctl';
  return 'text';
};

/** a kind the manifest lists that no definition declares: its files, as they are */
const undeclared = (
  kind: string,
  paths: readonly string[],
): ProjectResourceDefinition => ({
  label: kind,
  format: formatOf(paths[0] ?? ''),
  ...(paths.length > 1 && { many: true }),
  path: paths[0] ?? '',
});

/** A kind's slot from the manifest's entry: a folder entry (`props/`) stands for the files in it. */
const listedSlot = (
  kind: string,
  definition: ProjectResourceDefinition,
  listed: string | readonly string[],
  files: readonly string[],
  declared: boolean,
): ResourceSlot => {
  const entries: readonly string[] =
    typeof listed === 'string' ? [listed] : listed;
  const wanted = entries.flatMap((entry) =>
    entry.endsWith('/') ? under(definition, entry, files) : [entry],
  );
  const paths = wanted.filter((path) => files.includes(path));
  return {
    kind,
    definition,
    paths,
    from: 'manifest',
    absent: wanted.filter((path) => !files.includes(path)),
    missing: paths.length === 0,
    declared,
  };
};

/**
 * Every declared kind's slot in a project of these files, then the kinds its
 * manifest lists that no definition declares (a dialect without an engine
 * yet): their files, shown as they are, read by nobody.
 */
export const resourceSlots = (
  manifest: Manifest,
  files: readonly string[],
  declarations: ProjectResourceDeclarations,
): ResourceSlot[] => [
  ...Object.entries(declarations).map(([kind, definition]): ResourceSlot => {
    const listed = manifest.projectResources[kind];
    if (listed !== undefined)
      return listedSlot(kind, definition, listed, files, true);
    const paths = definition.many
      ? under(definition, definition.path, files)
      : files.includes(definition.path)
        ? [definition.path]
        : [];
    return {
      kind,
      definition,
      paths,
      from: paths.length ? 'default' : null,
      absent: [],
      missing: paths.length === 0,
      declared: true,
    };
  }),
  ...Object.entries(manifest.projectResources)
    .filter(([kind]) => !(kind in declarations))
    .map(([kind, listed]) =>
      listedSlot(kind, undeclared(kind, [listed].flat()), listed, files, false),
    ),
];

/** A file of the open project, as its listing shows it. */
export type ListedFile = {
  path: string;
  role: 'model' | 'projectResource' | 'output' | 'other';
  /** a project resource's kind */
  kind?: string;
};

/**
 * What a project lists: its own files only, by role (its models, its
 * project resources by slot, its outputs, the rest). An open project is its
 * own tree: other projects (the examples) are opened from the start screen,
 * never listed beside it.
 */
export const projectListing = (
  manifest: Manifest,
  files: readonly string[],
  slots: readonly ResourceSlot[],
  models: readonly string[],
): ListedFile[] => {
  const listed = new Map<string, ListedFile>();
  for (const path of models) listed.set(path, { path, role: 'model' });
  for (const slot of slots)
    for (const path of slot.paths)
      if (!listed.has(path))
        listed.set(path, { path, role: 'projectResource', kind: slot.kind });
  const outputs = new Set(manifest.outputs.map((output) => output.path));
  for (const path of [...files].sort()) {
    if (listed.has(path) || path === PROJECT_FILE) continue;
    listed.set(path, {
      path,
      role: outputs.has(path) || path.startsWith('out/') ? 'output' : 'other',
    });
  }
  return [...listed.values()];
};

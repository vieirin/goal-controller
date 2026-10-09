/**
 * A project's resources, by what its dialect declares (goal-controller#25):
 * each kind is in the project where its manifest says, or at the
 * declaration's default path, or missing. Missing is not an error: a project
 * without its world is a model alone, as before.
 */
import type { ProjectResourceDefinition } from '@goal-controller/dialect';
import type { Manifest } from './manifest';

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

/** Every declared kind's slot in a project of these files. */
export const resourceSlots = (
  manifest: Manifest,
  files: readonly string[],
  declarations: ProjectResourceDeclarations,
): ResourceSlot[] =>
  Object.entries(declarations).map(([kind, definition]) => {
    const listed = manifest.projectResources[kind];
    if (listed !== undefined) {
      const entries = Array.isArray(listed) ? listed : [listed];
      // a folder entry (`props/`) stands for the files in it
      const wanted = entries.flatMap((entry) =>
        entry.endsWith('/') ? under(definition, entry, files) : [entry],
      );
      const paths = wanted.filter((path) => files.includes(path));
      return {
        kind,
        definition,
        paths,
        from: 'manifest' as const,
        absent: wanted.filter((path) => !files.includes(path)),
        missing: paths.length === 0,
      };
    }
    const paths = definition.many
      ? under(definition, definition.path, files)
      : files.includes(definition.path)
        ? [definition.path]
        : [];
    return {
      kind,
      definition,
      paths,
      from: paths.length ? ('default' as const) : null,
      absent: [],
      missing: paths.length === 0,
    };
  });

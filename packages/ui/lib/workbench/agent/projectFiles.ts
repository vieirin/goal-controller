/**
 * The open project's files an @-chip in the agent's composer can attach
 * (goal-controller#485): the model's own text, then the resources the
 * engine reads, the model's native files, the engine's latest output (as
 * generated, ahead of a copy saved in out/) and the other files open in a
 * tab, each once.
 */
import { outputPath, type NativeSlot, type ResourceSlot } from '@/lib/project';
import type { OutputFile } from '@/lib/workbench/outputs';

/** one of the open project's files; no text while it hasn't been read */
export type ProjectFile = { path: string; name: string; text?: string };

export type ProjectFilesOf = {
  model: { path: string | null; fileName: string; text: string };
  resourceSlots: readonly Pick<ResourceSlot, 'paths'>[];
  nativeSlots: readonly Pick<NativeSlot, 'path' | 'missing'>[];
  /** the latest run's files (`wb.lastGood`) */
  outputs: readonly Pick<OutputFile, 'fileName' | 'text'>[];
  openedFiles: readonly string[];
  /** the project files' texts, by path (`wb.resourceTexts`) */
  texts: Readonly<Record<string, string>>;
};

const nameOf = (path: string): string => path.split('/').at(-1) ?? path;

/** where an output is kept in the project; none for a name outside out/ */
const outputPathOf = (
  file: Pick<OutputFile, 'fileName'>,
): string | undefined => {
  try {
    return outputPath(file);
  } catch {
    return undefined;
  }
};

export const projectFilesOf = ({
  model,
  resourceSlots,
  nativeSlots,
  outputs,
  openedFiles,
  texts,
}: ProjectFilesOf): readonly ProjectFile[] => {
  const files = new Map<string, ProjectFile>();
  const add = (file: ProjectFile) => {
    if (!files.has(file.path)) files.set(file.path, file);
  };
  const stored = (path: string): ProjectFile => ({
    path,
    name: nameOf(path),
    text: texts[path],
  });
  if (model.fileName)
    add({
      path: model.path ?? model.fileName,
      name: nameOf(model.fileName),
      text: model.text,
    });
  for (const { paths } of resourceSlots)
    for (const path of paths) add(stored(path));
  for (const { path, missing } of nativeSlots) if (!missing) add(stored(path));
  for (const file of outputs) {
    const path = outputPathOf(file);
    if (path) add({ path, name: nameOf(file.fileName), text: file.text });
  }
  for (const path of openedFiles) add(stored(path));
  return [...files.values()];
};

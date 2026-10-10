/**
 * What an engine makes of one model: one or more named text files
 * (goal-controller#33). Exactly one of them is primary: shown first, traced
 * to the model, compared with the previous run, read back as an Edge
 * engine's `previousOutput`, and downloaded by default.
 */

export type EngineOutputFile = {
  /** stable key across runs, e.g. 'model', 'reachability-max' */
  id: string;
  /** suggested file name relative to out/, e.g. 'BSN.nm' */
  fileName: string;
  text: string;
  /** editor language for highlighting, e.g. 'prism', 'pctl', 'sleec', 'shell' */
  language?: string;
  /** the file shown first and used for trace, diff with previous output, and download by default */
  primary?: boolean;
  /**
   * The model elements each line belongs to (0-based lines), for the
   * workbench's trace. Without it, a primary file is traced by the ids its
   * identifiers embed and any other file shows as plain text.
   */
  owners?: ReadonlyArray<readonly string[]>;
};

export type EngineOutput = { files: EngineOutputFile[] };

/** A model's base name, without the .txt or .json it is read from: `lab.txt` → `lab`. */
export const outputBaseName = (modelName: string): string =>
  modelName.replace(/\.(txt|json)$/i, '') || 'model';

/**
 * An engine that makes one string as an EngineOutput: one primary file,
 * named after the model with the engine's extension.
 */
export const singleFileOutput = ({
  id,
  modelName,
  extension,
  text,
  language,
}: {
  id: string;
  modelName: string;
  extension: string;
  text: string;
  language?: string;
}): EngineOutput => ({
  files: [
    {
      id,
      fileName: `${outputBaseName(modelName)}.${extension}`,
      text,
      ...(language !== undefined && { language }),
      primary: true,
    },
  ],
});

/**
 * Why a file name can't be an output's, or null: it is relative to `out/`
 * and stays in it (no `..` or `.` segment, no leading `/`, no `\`, not empty).
 */
export const outputFileNameProblem = (fileName: string): string | null =>
  !fileName ||
  fileName.startsWith('/') ||
  fileName.includes('\\') ||
  fileName.split('/').some((part) => part === '..' || part === '.' || !part)
    ? `fileName ${JSON.stringify(fileName)} is not a path inside out/`
    : null;

/**
 * What is wrong with an engine's output: not exactly one primary file, ids or
 * file names repeated, a file name that isn't a path inside `out/`.
 */
export const engineOutputProblems = (output: EngineOutput): string[] => {
  const problems: string[] = [];
  const primaries = output.files.filter((file) => file.primary).length;
  if (primaries !== 1)
    problems.push(`expected exactly one primary file, got ${primaries}`);
  const repeated = (key: 'id' | 'fileName'): string[] => {
    const seen = new Set<string>();
    return output.files.flatMap((file) => {
      if (!seen.has(file[key])) {
        seen.add(file[key]);
        return [];
      }
      return [`${key} ${file[key]} is used twice`];
    });
  };
  const unsafe = output.files.flatMap((file) => {
    const problem = outputFileNameProblem(file.fileName);
    return problem ? [problem] : [];
  });
  return [...problems, ...repeated('id'), ...repeated('fileName'), ...unsafe];
};

/** An output's primary file; throws when it hasn't exactly one. */
export const primaryFile = (output: EngineOutput): EngineOutputFile => {
  const primaries = output.files.filter((file) => file.primary);
  if (primaries.length !== 1)
    throw new Error(
      `an engine output has exactly one primary file, got ${primaries.length}`,
    );
  return primaries[0]!;
};

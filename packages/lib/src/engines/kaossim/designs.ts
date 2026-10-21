/**
 * kaossim's designs (goal-controller#193, D2): the alternative systems a
 * simulation compares, a project resource (they are no element of the
 * model). A design picks one option per decision point, by its `SysRef`
 * (RE'11's system reference), the shape of #152's selections; it may set
 * leaf estimates too, for a what-if (FSE'04 §5.1: "if the probabilities of
 * these three variables increase to 5%, 10%, and 10%").
 *
 * `designs.json`:
 *
 * ```json
 * {
 *   "designs": [
 *     {
 *       "id": "s2",
 *       "name": "Automated system S2",
 *       "options": ["software-call-taking", "mdt"],
 *       "set": { "FalseAvailability": "5%" },
 *       "source": "FSE'04 Table 3"
 *     }
 *   ]
 * }
 * ```
 *
 * Values are kept as written; `set`'s are distributions (a value, or
 * `exponential[60]`), over the reals.
 */
import {
  jsonText,
  readDistribution,
  type Distribution,
} from '@goal-controller/dialect';
import {
  keyRange,
  readJson,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';

export const DESIGNS_PATH = 'designs.json';

/** A design as written. `set`'s keys are the model's variable names (any the model has: open). */
export type DesignEntry = {
  id: string;
  name?: string;
  options: string[];
  set?: Readonly<Record<string, string>>;
  source?: string;
};
export type DesignsFile = { designs: DesignEntry[] };

export const designsText = (file: DesignsFile): string => jsonText(file);

/** A design read: its picks, and the estimates it sets, by variable. */
export type Design = {
  id: string;
  name: string;
  options: readonly string[];
  set: ReadonlyMap<string, { distribution: Distribution; text: string }>;
  source?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The designs, as the files declare them, with what is wrong in them. */
export const readDesigns = (
  files: readonly ResourceFile[],
): { designs: Design[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const designs: Design[] = [];
  for (const file of files) {
    const { value, diagnostics: json } = readJson(file);
    diagnostics.push(...json);
    if (value === undefined) continue;
    const problem = (key: string, message: string) =>
      diagnostics.push({
        path: file.path,
        severity: 'error',
        message,
        ...keyRange(file.text, key),
      });
    if (!isRecord(value) || !Array.isArray(value.designs)) {
      problem('designs', 'A designs file has a `designs` list');
      continue;
    }
    for (const entry of value.designs) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) {
        problem('designs', 'A design has an `id`');
        continue;
      }
      const id = entry.id;
      if (designs.some((d) => d.id === id)) {
        problem(id, `Design ${id} is declared twice`);
        continue;
      }
      const options: unknown = entry.options;
      if (
        !Array.isArray(options) ||
        !options.every((o): o is string => typeof o === 'string')
      ) {
        problem(id, `Design ${id}: its options are a list of SysRefs`);
        continue;
      }
      const set = new Map<
        string,
        { distribution: Distribution; text: string }
      >();
      if (entry.set !== undefined) {
        if (!isRecord(entry.set)) problem(id, `Design ${id}: set is an object`);
        else
          for (const [variable, text] of Object.entries(entry.set)) {
            const read =
              typeof text === 'string'
                ? readDistribution(text, { point: true, range: 'real' })
                : { error: 'not a text' };
            if ('error' in read)
              problem(variable, `Design ${id}, ${variable}: ${read.error}`);
            else
              set.set(variable, {
                distribution: read.distribution,
                text: String(text),
              });
          }
      }
      designs.push({
        id,
        name: typeof entry.name === 'string' && entry.name ? entry.name : id,
        options,
        set,
        ...(typeof entry.source === 'string' && { source: entry.source }),
      });
    }
  }
  return { designs, diagnostics };
};

/** The designs as symbols (by id, their name the detail) and as data. */
export const parseDesigns: ProjectResourceParser<{
  designs: { id: string; name: string; options: string[] }[];
}> = (files) => {
  const { designs, diagnostics } = readDesigns(files);
  return {
    symbols: {
      designs: designs.map((d) => ({ name: d.id, detail: d.name })),
    },
    data: {
      designs: designs.map((d) => ({
        id: d.id,
        name: d.name,
        options: [...d.options],
      })),
    },
    diagnostics,
  };
};

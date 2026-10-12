/**
 * The Edge engines' variables (`variables.json`): a value for each of the
 * model's context variables (true/false) and achievability variables (a
 * probability), as the generation reads them: `{ "isRaining": false,
 * "T1_achievable": 0.9 }`. Read by its typed reader (readers/variables.ts).
 */
import { read } from '../../../readers';
import type {
  ParsedResource,
  ProjectResourceParser,
} from '../../projectResources';
import { variablesReader } from '../readers/variables';

export type EdgeVariables = Record<string, boolean | number>;

export const parseVariables: ProjectResourceParser<EdgeVariables> = (
  files,
): ParsedResource<EdgeVariables> => {
  const [file] = files;
  if (!file) return { symbols: {}, data: {}, diagnostics: [] };
  const { value = {}, problems } = read(variablesReader, file.path, file.text);
  return {
    symbols: {
      variables: Object.entries(value).map(([name, raw]) => ({
        name,
        detail: String(raw),
      })),
    },
    data: value,
    diagnostics: problems.map((problem) => ({ path: file.path, ...problem })),
  };
};

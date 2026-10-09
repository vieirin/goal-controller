/**
 * The Edge engines' variables (`variables.json`): a value for each of the
 * model's context variables (true/false) and achievability variables (a
 * probability), as the generation reads them: `{ "isRaining": false,
 * "T1_achievable": 0.9 }`.
 */
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
} from '../../projectResources';

export type EdgeVariables = Record<string, boolean | number>;

export const parseVariables: ProjectResourceParser<EdgeVariables> = (
  files,
): ParsedResource<EdgeVariables> => {
  const values: EdgeVariables = {};
  const [file] = files;
  if (!file) return { symbols: {}, data: values, diagnostics: [] };
  const { value, diagnostics } = readJson(file);
  if (value !== undefined) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      diagnostics.push({
        path: file.path,
        severity: 'error',
        message: 'The variables are a JSON object: `{ "name": value }`',
        from: 0,
        to: Math.min(1, file.text.length),
      });
    else
      for (const [name, raw] of Object.entries(value))
        if (typeof raw === 'boolean' || typeof raw === 'number')
          values[name] = raw;
        else
          diagnostics.push({
            path: file.path,
            severity: 'error',
            message: `${name}: a variable is true, false or a number`,
            ...keyRange(file.text, name),
          });
  }
  return {
    symbols: {
      variables: Object.entries(values).map(([name, raw]) => ({
        name,
        detail: String(raw),
      })),
    },
    data: values,
    diagnostics,
  };
};

import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';

/**
 * The variables a model is generated with (`variables.json`: a value per
 * context variable), read from beside the model (a project's layout,
 * `examples/edge/experiments/<model>/variables.json`) or from the older
 * `input/<model>/variables.json`. None: `{}`, and the System module's
 * variables are written without an initial value.
 *
 * Only `fs`, no `fs/promises`, for the same reason as `previousOutput.ts`.
 */
export const readVariablesFile = (
  modelPath: string,
): Record<string, boolean | number> => {
  const name = basename(modelPath).replace(/\.(txt|json)$/i, '');
  const candidates = [
    join(dirname(modelPath), 'variables.json'),
    join('input', name, 'variables.json'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) return {};
  return JSON.parse(readFileSync(found, 'utf8')) as Record<
    string,
    boolean | number
  >;
};

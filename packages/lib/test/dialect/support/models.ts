import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';

/** The repository's root. */
export const ROOT = join(__dirname, '..', '..', '..', '..', '..');

/**
 * Every piStar model under a directory (some .txt files there are not models),
 * as `read` reads them (default: plain iStar 2.0).
 */
export const models = (
  dir: string,
  read: (text: string) => unknown = parsePistar,
): Array<{ file: string; model: string }> =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const file = join(ROOT, dir, name);
    if (statSync(file).isDirectory()) return models(relative(ROOT, file), read);
    if (!name.endsWith('.txt')) return [];
    const model = readFileSync(file, 'utf8');
    try {
      read(model);
      return [{ file: relative(ROOT, file), model }];
    } catch {
      return [];
    }
  });

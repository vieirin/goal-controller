/**
 * The registry (lib/workbench/engineDialects.ts) is the one place an engine
 * is named: no other source file in packages/ui writes a registered engine's
 * id as a string literal (an `if (engine === 'goda')`, a `case 'sleec':`, a
 * map keyed by ids). Each exception is listed with its reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_IDS } from '@/lib/workbench/engineDialects';

const UI = join(__dirname, '..', '..');

/** Where an engine may be named, and why. */
const ALLOWED: Readonly<Record<string, string>> = {
  'lib/workbench/engineDialects.ts':
    'the registry: where each engine is registered',
  'components/workbench/home/Home.tsx':
    "GROUP_ORDER: the home page's sections, by example folder, in an order of their own; a folder it doesn't list comes after, by name",
};

const SKIPPED = new Set([
  'node_modules',
  '.next',
  '.next-e2e',
  'test',
  'e2e',
  'public',
  'out',
]);

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (SKIPPED.has(name) || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });

describe('engine ids in packages/ui', () => {
  const ids = ENGINE_IDS.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const literal = new RegExp(`(['"\`])(${ids.join('|')})\\1`, 'g');

  it('are written only in the registry', () => {
    const found = sources(UI).flatMap((path) => {
      const file = relative(UI, path);
      if (file in ALLOWED) return [];
      return readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          [...line.matchAll(literal)].map(
            (match) => `${file}:${i + 1}: ${match[0]}`,
          ),
        );
    });
    expect(found).toEqual([]);
  });

  it('allows only files that exist', () => {
    for (const file of Object.keys(ALLOWED))
      expect(statSync(join(UI, file)).isFile(), file).toBe(true);
  });
});

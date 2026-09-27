import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import type { ExampleFile } from '../../../lib/workbench/types';

// examples/ at the repository root (the UI runs from packages/ui)
const EXAMPLES_ROOT = path.resolve(process.cwd(), '..', '..', 'examples');
// generated conformance models are not hand-written examples
const SKIP_DIRS = new Set(['generated', 'props', 'results']);

/** Only piStar goal models (some .txt files in examples/ are PRISM sketches). */
const isGoalModel = async (file: string): Promise<boolean> => {
  try {
    const model = JSON.parse(await fs.readFile(file, 'utf8')) as { actors?: unknown };
    return Array.isArray(model.actors);
  } catch {
    return false;
  }
};

const listExamples = async (dir: string, group: string): Promise<ExampleFile[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: ExampleFile[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await listExamples(full, group || entry.name)));
      }
    } else if (entry.name.endsWith('.txt') && (await isGoalModel(full))) {
      files.push({
        path: path.relative(EXAMPLES_ROOT, full),
        group: group || 'examples',
        name: path.relative(path.join(EXAMPLES_ROOT, group), full),
      });
    }
  }
  return files;
};

/**
 * GET              → { examples: ExampleFile[] } (empty when examples/ is not deployed)
 * GET ?path=<rel>  → { fileName, content }
 */
export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get('path');
    if (!requested) {
      try {
        const examples = await listExamples(EXAMPLES_ROOT, '');
        examples.sort((a, b) => a.path.localeCompare(b.path));
        return ApiResponse.success({ examples });
      } catch {
        return ApiResponse.success({ examples: [] });
      }
    }

    const resolved = path.resolve(EXAMPLES_ROOT, requested);
    if (!resolved.startsWith(EXAMPLES_ROOT + path.sep) || !resolved.endsWith('.txt')) {
      return ApiResponse.badRequest('path must point to a .txt file inside examples/');
    }
    const content = await fs.readFile(resolved, 'utf8');
    return ApiResponse.success({ fileName: path.basename(resolved), content });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

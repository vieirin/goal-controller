import type { ExampleFile } from '../lib/workbench/types';
import examples from '../lib/examples-manifest.json';

/** Set by CI to the commit SHA, so the files the list points at match that commit. */
const REF = process.env.NEXT_PUBLIC_EXAMPLES_REF || 'main';

/** The example list, baked in at build time (scripts/examples-manifest.mjs). */
export const listExamples = async (): Promise<ExampleFile[]> =>
  examples as ExampleFile[];

/** An example's contents, read straight from GitHub (the repo is public). */
export const loadExample = async (
  path: string,
): Promise<{ fileName: string; content: string }> => {
  const url = `https://raw.githubusercontent.com/vieirin/goal-controller/${REF}/examples/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const response = await fetch(url);
  if (!response.ok) {
    // the manifest lists local files; one added or renamed locally and not yet
    // pushed to REF isn't on GitHub yet
    throw new Error(
      `Couldn't load ${path}: ${response.status} ${response.statusText} (not pushed to ${REF}?)`,
    );
  }
  const content = await response.text();
  return { fileName: path.split('/').pop() ?? path, content };
};

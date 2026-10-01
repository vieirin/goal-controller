import type { ExampleFile } from '../lib/workbench/types';

/** Set by CI to the commit SHA, so the manifest and the files it lists always match. */
const REF = process.env.NEXT_PUBLIC_EXAMPLES_REF || 'main';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** The example list, built at build time (scripts/examples-manifest.mjs) into public/. */
export const listExamples = async (): Promise<ExampleFile[]> => {
  const response = await fetch(`${BASE_PATH}/examples.json`);
  if (!response.ok) {
    throw new Error(
      `Couldn't load the example list: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as ExampleFile[];
};

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

import {
  githubStore,
  openProject,
  type Project,
  type ProjectIndexEntry,
} from '../lib/project';
import type { TransformEngine } from '../lib/types';
import { isDialectMode, type DialectMode } from '../lib/workbench/dialects';
import { writeModelMode } from '../lib/workbench/pistar';
import type { ModelSettings } from '../lib/workbench/types';
import examples from '../lib/examples-manifest.json';

/** Set by CI to the commit SHA, so the files the list points at match that commit. */
const REF = process.env.NEXT_PUBLIC_EXAMPLES_REF || 'main';

/** The example projects, indexed at build time (scripts/examples-manifest.mjs). */
export const listExamples = async (): Promise<ProjectIndexEntry[]> =>
  examples as ProjectIndexEntry[];

/** examples/<group>/: the engine, or the dialect, its models are for */
const EXAMPLE_ENGINES: Record<string, TransformEngine | DialectMode> = {
  edge: 'edge',
  edgeV2: 'edgev2',
  sleec: 'sleec',
  mutrose: 'mutrose',
  'pistar-ext': 'pistarext',
};

export type OpenedExample = {
  project: Project;
  fileName: string;
  /** its model, with the engine (or dialect) of its folder recorded */
  text: string;
  settings?: Partial<ModelSettings>;
};

/**
 * An example project, read straight from GitHub (the repo is public) at REF:
 * the index says what it holds, so only its files are fetched. Examples are
 * grouped by the engine they target, recorded in the model so it opens (and
 * reopens from Recent) for it.
 */
export const openExample = async (
  entry: ProjectIndexEntry,
  fetch?: Parameters<typeof githubStore>[0]['fetch'],
): Promise<OpenedExample> => {
  const project = await openProject(
    githubStore({
      ref: REF,
      path: `examples/${entry.root}`,
      files: entry.files,
      form: entry.form,
      ...(fetch && { fetch }),
    }),
  );
  const [model] = project.models;
  if (!model) throw new Error(`${entry.path}: no model`);
  const engine = EXAMPLE_ENGINES[entry.group];
  return {
    project,
    fileName: model.path.split('/').pop() ?? model.path,
    text: engine ? writeModelMode(model.text, engine) : model.text,
    ...(engine && !isDialectMode(engine) && { settings: { engine } }),
  };
};

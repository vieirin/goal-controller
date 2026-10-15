/**
 * Tropos4AS's scenarios as a project resource (`scenarios/`, one JSON file
 * per scenario): what the world does while the agent runs, step by step.
 *
 * ```json
 * {
 *   "label": "AAMAS 2009 §5",
 *   "steps": [
 *     { "label": "the broom", "beliefs": { "roomClean": false }, "outcomes": { "DC": "success" } },
 *     { "label": "the mop", "beliefs": { "roomClean": true }, "outcomes": { "WC": "failure" } }
 *   ]
 * }
 * ```
 *
 * - `beliefs`: what the agent comes to believe at the step, by name (a
 *   condition's variable): a bool, a number or a word. The others keep
 *   their values; a name never set is false.
 * - `outcomes`: how a subgoal the agent pursues turns out, `success` or
 *   `failure`, by its piStar id (`DC`), or its id in a dialect with ids. An element with an
 *   outcome in a scenario is executed, not decomposed: its lifecycle is not
 *   run (a leaf-level goal, AAMAS 2009 §4.2.2). Each outcome serves one
 *   adoption; a subgoal adopted again waits for the next step's.
 * - The beliefs and the outcome of a step are B′, what pursuing the pending
 *   subgoal led to (`⟨B, adopt(G, γ)⟩ → B′`, #134 D5).
 */
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';

export type Outcome = 'success' | 'failure';

export type ScenarioStep = {
  label: string;
  beliefs: Readonly<Record<string, boolean | number | string>>;
  outcomes: Readonly<Record<string, Outcome>>;
};

export type Scenario = {
  /** its file's path */
  path: string;
  label: string;
  steps: readonly ScenarioStep[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads one file's scenario, with what is wrong in it. */
const readFile = (
  file: ResourceFile,
  diagnostics: ResourceDiagnostic[],
): Scenario | null => {
  const { value, diagnostics: json } = readJson(file);
  diagnostics.push(...json);
  if (value === undefined) return null;
  const problem = (key: string, message: string) =>
    diagnostics.push({
      path: file.path,
      severity: 'error',
      message,
      ...keyRange(file.text, key),
    });
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    problem('steps', 'A scenario has a `steps` list');
    return null;
  }
  const steps = value.steps.flatMap((step, i): ScenarioStep[] => {
    if (!isRecord(step)) {
      problem('steps', `Step ${i + 1} is an object`);
      return [];
    }
    const beliefs: Record<string, boolean | number | string> = {};
    for (const [name, belief] of Object.entries(
      isRecord(step.beliefs) ? step.beliefs : {},
    )) {
      if (
        typeof belief === 'boolean' ||
        typeof belief === 'number' ||
        typeof belief === 'string'
      )
        beliefs[name] = belief;
      else
        problem(
          name,
          `Step ${i + 1}: belief ${name} is a bool, a number or a word`,
        );
    }
    const outcomes: Record<string, Outcome> = {};
    for (const [id, outcome] of Object.entries(
      isRecord(step.outcomes) ? step.outcomes : {},
    )) {
      if (outcome === 'success' || outcome === 'failure')
        outcomes[id] = outcome;
      else problem(id, `Step ${i + 1}: ${id}'s outcome is success or failure`);
    }
    return [
      {
        label: typeof step.label === 'string' ? step.label : `step ${i + 1}`,
        beliefs,
        outcomes,
      },
    ];
  });
  return {
    path: file.path,
    label: typeof value.label === 'string' ? value.label : file.path,
    steps,
  };
};

/** Every scenario of a project's files, in their paths' order. */
export const readScenarios = (
  files: readonly ResourceFile[],
): { scenarios: Scenario[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const scenarios = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .flatMap((file) => readFile(file, diagnostics) ?? []);
  return { scenarios, diagnostics };
};

/** The project resource's parser: the scenarios, their labels as symbols. */
export const parseScenarios: ProjectResourceParser<{
  scenarios: Scenario[];
}> = (files): ParsedResource<{ scenarios: Scenario[] }> => {
  const { scenarios, diagnostics } = readScenarios(files);
  return {
    symbols: {
      scenarios: scenarios.map((scenario) => ({
        name: scenario.label,
        detail: `${scenario.steps.length} steps`,
      })),
    },
    // JSON: it crosses to the language server
    data: { scenarios },
    diagnostics,
  };
};

/**
 * Contextual goal models' project resources (goal-controller#151 D15): the
 * situations the runtime derivation is run in (REJ 2010 §4, Code 3), and
 * the analyst's logical relations (§5.1). Nothing of either is in the model.
 *
 * `situations/<name>.json`, one situation each:
 *
 * ```json
 * { "label": "Code 3", "contexts": { "C14": true }, "priorities": { "SG1": 3, "SG2": 1 } }
 * ```
 *
 * - `contexts`: the contexts that hold, by id; `facts`: the facts that do.
 *   A context holds if it is listed, or if its formula holds over the facts
 *   (its statements through their supporting formulas, §3.4). Closed-world:
 *   what isn't listed true is false (Code 3's `phi(c14).`).
 * - `priorities`: each softgoal's, an integer from 0 ("I don't care") up,
 *   by its id (`SG1`) or piStar id; an unlisted softgoal's is 0.
 *
 * `relations/<name>.json`, one set of relations each:
 *
 * ```json
 * { "label": "Fig. 13", "absolute": ["!C13 | C12"], "environments": { "dark museum": ["!F3"] } }
 * ```
 *
 * Each relation is an assertion over contexts, statements and facts (`a →
 * b` written `!a | b`, #151 D3). The absolute ones
 * hold everywhere; an environment's hold with them in that environment
 * (`Env → …`).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';
import { formulaOf } from './formulas';

export type Situation = {
  /** its file's path */
  path: string;
  label: string;
  /** the contexts it states hold */
  contexts: readonly string[];
  /** the facts it states hold */
  facts: readonly string[];
  priorities: Readonly<Record<string, number>>;
};

export type Relation = { text: string; tree: AssertionTree };

export type RelationSet = {
  path: string;
  label: string;
  absolute: readonly Relation[];
  environments: Readonly<Record<string, readonly Relation[]>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const byPath = (files: readonly ResourceFile[]) =>
  [...files].sort((a, b) => a.path.localeCompare(b.path));

/** A problem at a key of a file. */
const problemAt =
  (file: ResourceFile, diagnostics: ResourceDiagnostic[]) =>
  (key: string, message: string) =>
    diagnostics.push({
      path: file.path,
      severity: 'error',
      message,
      ...keyRange(file.text, key),
    });

const readSituation = (
  file: ResourceFile,
  diagnostics: ResourceDiagnostic[],
): Situation | null => {
  const { value, diagnostics: json } = readJson(file);
  diagnostics.push(...json);
  if (value === undefined) return null;
  const problem = problemAt(file, diagnostics);
  if (!isRecord(value)) {
    problem('contexts', 'A situation is an object');
    return null;
  }
  if (!isRecord(value.contexts) && !isRecord(value.facts)) {
    problem(
      'contexts',
      'A situation states the contexts that hold, the facts that do, or both: `contexts`, `facts`',
    );
    return null;
  }
  const holding = (key: 'contexts' | 'facts'): string[] =>
    Object.entries(isRecord(value[key]) ? value[key] : {}).flatMap(
      ([id, holds]) => {
        if (typeof holds === 'boolean') return holds ? [id] : [];
        problem(id, `${id} holds or not: true or false`);
        return [];
      },
    );
  const contexts = holding('contexts');
  const facts = holding('facts');
  const priorities: Record<string, number> = {};
  for (const [id, priority] of Object.entries(
    isRecord(value.priorities) ? value.priorities : {},
  )) {
    if (
      typeof priority === 'number' &&
      Number.isInteger(priority) &&
      priority >= 0
    )
      priorities[id] = priority;
    else problem(id, `${id}'s priority is an integer, 0 or more`);
  }
  return {
    path: file.path,
    label: typeof value.label === 'string' ? value.label : file.path,
    contexts,
    facts,
    priorities,
  };
};

const readRelations = (
  list: unknown,
  key: string,
  problem: (key: string, message: string) => void,
): Relation[] => {
  if (list === undefined) return [];
  if (!Array.isArray(list)) {
    problem(key, `${key} is a list of relations`);
    return [];
  }
  return list.flatMap((text): Relation[] => {
    const tree = typeof text === 'string' ? formulaOf(text) : null;
    if (!tree || typeof text !== 'string') {
      problem(
        typeof text === 'string' ? text : key,
        `Not a relation: ${JSON.stringify(text)} (an assertion, \`!C13 | C12\`)`,
      );
      return [];
    }
    return [{ text, tree }];
  });
};

const readRelationSet = (
  file: ResourceFile,
  diagnostics: ResourceDiagnostic[],
): RelationSet | null => {
  const { value, diagnostics: json } = readJson(file);
  diagnostics.push(...json);
  if (value === undefined) return null;
  const problem = problemAt(file, diagnostics);
  if (!isRecord(value)) {
    problem('absolute', 'A relations file is an object');
    return null;
  }
  const environments: Record<string, Relation[]> = {};
  if (value.environments !== undefined && !isRecord(value.environments))
    problem('environments', 'environments maps a name to its relations');
  for (const [name, list] of Object.entries(
    isRecord(value.environments) ? value.environments : {},
  ))
    environments[name] = readRelations(list, name, problem);
  return {
    path: file.path,
    label: typeof value.label === 'string' ? value.label : file.path,
    absolute: readRelations(value.absolute, 'absolute', problem),
    environments,
  };
};

/** Every situation of a project's files, in their paths' order. */
export const readSituations = (
  files: readonly ResourceFile[],
): { situations: Situation[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const situations = byPath(files).flatMap(
    (file) => readSituation(file, diagnostics) ?? [],
  );
  return { situations, diagnostics };
};

/** Every relations file of a project, in their paths' order. */
export const readRelationSets = (
  files: readonly ResourceFile[],
): { relations: RelationSet[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const relations = byPath(files).flatMap(
    (file) => readRelationSet(file, diagnostics) ?? [],
  );
  return { relations, diagnostics };
};

/** The resource's files, as the analyses get them (path → text). */
export const resourceFiles = (
  resource: Readonly<Record<string, string>> | undefined,
): ResourceFile[] =>
  Object.entries(resource ?? {}).map(([path, text]) => ({ path, text }));

export const parseSituations: ProjectResourceParser<{
  situations: Situation[];
}> = (files): ParsedResource<{ situations: Situation[] }> => {
  const { situations, diagnostics } = readSituations(files);
  return {
    symbols: {
      situations: situations.map((situation) => ({
        name: situation.label,
        detail: `${situation.contexts.length} contexts, ${situation.facts.length} facts hold`,
      })),
    },
    data: { situations },
    diagnostics,
  };
};

export const parseRelations: ProjectResourceParser<{
  relations: { path: string; label: string }[];
}> = (files) => {
  const { relations, diagnostics } = readRelationSets(files);
  return {
    symbols: {
      relations: relations.map((set) => ({
        name: set.label,
        detail: `${set.absolute.length} absolute, ${Object.keys(set.environments).length} environments`,
      })),
    },
    // JSON: it crosses to the language server (the trees are re-read)
    data: {
      relations: relations.map(({ path, label }) => ({ path, label })),
    },
    diagnostics,
  };
};

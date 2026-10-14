/**
 * GRL's strategies as a project resource (`strategies/`, one JSON file per
 * strategies group): what each strategy sets an element to before
 * propagation. jUCMNav keeps them in the model (`grlspec/strategies`) and
 * saves only these initial values; the propagated ones are computed.
 *
 * ```json
 * {
 *   "group": "Smart home",
 *   "preferences": { "range": "full", "tolerance": 10 },
 *   "strategies": [
 *     {
 *       "id": "6",
 *       "name": "Comfort first",
 *       "author": "YK",
 *       "includes": ["7"],
 *       "evaluations": {
 *         "147": { "value": 100, "label": "Satisfied" },
 *         "112": { "kpi": { "targetValue": 30, "thresholdValue": 90, "worstValue": 360, "evaluationValue": 45, "unit": "days" } }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * - `id`: the strategy's (the `.jucm`'s, when imported); unique in the project.
 * - `evaluations`: by element id (the piStar id); `value` −100..100 (0..100
 *   with `range: "positive"`), `label` one of GRL's qualitative labels; a
 *   missing value is 0, a missing label None.
 * - `includes`: strategies whose evaluations come first, as jUCMNav's
 *   `includedStrategies` (this strategy's own win).
 * - `preferences` (optional, the group's): jUCMNav's evaluation range
 *   (`full`, −100..100, or `positive`, 0..100) and tolerance (default 10,
 *   jUCMNav's).
 * - `kpi`: an indicator's KPI value set, kept as jUCMNav writes it (KPI
 *   conversion is not ported: goal-controller#106, still open).
 */
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';
import { GRL_QUALITATIVE_LABELS, type GrlQualitativeLabel } from './vocabulary';

export type GrlPreferences = {
  /** −100..100, or 0..100 (jUCMNav's "0 to 100" evaluation range) */
  range: 'full' | 'positive';
  /** how near 100 (or the range's bottom) a value must come to be capped short of it */
  tolerance: number;
};

export const DEFAULT_PREFERENCES: GrlPreferences = {
  range: 'full',
  tolerance: 10,
};

export type GrlStrategyEvaluation = {
  value: number;
  label: GrlQualitativeLabel;
  kpi?: Readonly<Record<string, string | number>>;
};

export type GrlStrategyFileEntry = {
  id: string;
  name: string;
  author?: string;
  includes?: readonly string[];
  evaluations: Readonly<
    Record<string, Partial<GrlStrategyEvaluation> | undefined>
  >;
};

/** One file: a strategies group. */
export type GrlStrategyFile = {
  group: string;
  preferences?: Partial<GrlPreferences>;
  strategies: readonly GrlStrategyFileEntry[];
};

/** A strategy as the evaluation reads it: its group's preferences, its includes resolved. */
export type GrlStrategy = {
  id: string;
  name: string;
  group: string;
  path: string;
  preferences: GrlPreferences;
  /** by element id, the included strategies' first, then its own */
  evaluations: ReadonlyMap<string, GrlStrategyEvaluation>;
};

export type GrlStrategies = { strategies: GrlStrategy[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A group's file name: its name, filename-safe. */
export const strategyFileName = (group: string): string =>
  `${
    group
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'strategies'
  }.json`;

/** A group as its file's text (two-space JSON, a final newline). */
export const writeStrategyFile = (file: GrlStrategyFile): string =>
  `${JSON.stringify(file, null, 2)}\n`;

type Entry = {
  path: string;
  text: string;
  group: string;
  preferences: GrlPreferences;
  entry: {
    id: string;
    name: string;
    includes: string[];
    evaluations: Map<string, GrlStrategyEvaluation>;
  };
};

/** Reads one file's strategies, with what is wrong in it. */
const readFile = (
  file: ResourceFile,
  diagnostics: ResourceDiagnostic[],
): Entry[] => {
  const { value, diagnostics: json } = readJson(file);
  diagnostics.push(...json);
  if (value === undefined) return [];
  const problem = (key: string, message: string) =>
    diagnostics.push({
      path: file.path,
      severity: 'error',
      message,
      ...keyRange(file.text, key),
    });
  if (!isRecord(value) || !Array.isArray(value.strategies)) {
    problem('strategies', 'A strategies file has a `strategies` list');
    return [];
  }
  const group = typeof value.group === 'string' ? value.group : file.path;
  const preferences: GrlPreferences = { ...DEFAULT_PREFERENCES };
  if (isRecord(value.preferences)) {
    const { range, tolerance } = value.preferences;
    if (range !== undefined) {
      if (range === 'full' || range === 'positive') preferences.range = range;
      else
        problem(
          'range',
          'The range is "full" (−100..100) or "positive" (0..100)',
        );
    }
    if (tolerance !== undefined) {
      if (
        Number.isInteger(tolerance) &&
        (tolerance as number) >= 0 &&
        (tolerance as number) <= 100
      )
        preferences.tolerance = tolerance as number;
      else problem('tolerance', 'The tolerance is an integer, 0..100');
    }
  }
  const low = preferences.range === 'positive' ? 0 : -100;
  return value.strategies.flatMap((strategy): Entry[] => {
    if (!isRecord(strategy) || typeof strategy.id !== 'string') {
      problem('id', 'A strategy has a string `id`');
      return [];
    }
    const evaluations = new Map<string, GrlStrategyEvaluation>();
    for (const [element, evaluation] of Object.entries(
      isRecord(strategy.evaluations) ? strategy.evaluations : {},
    )) {
      if (!isRecord(evaluation)) {
        problem(
          element,
          `Strategy ${strategy.id}: element ${element}'s evaluation is an object`,
        );
        continue;
      }
      const raw = evaluation.value ?? 0;
      const label = evaluation.label ?? 'None';
      if (
        !Number.isInteger(raw) ||
        (raw as number) < low ||
        (raw as number) > 100
      )
        problem(
          element,
          `Strategy ${strategy.id}: element ${element}'s value is an integer, ${low}..100`,
        );
      if (!GRL_QUALITATIVE_LABELS.includes(label as GrlQualitativeLabel))
        problem(
          element,
          `Strategy ${strategy.id}: element ${element}'s label is one of ${GRL_QUALITATIVE_LABELS.join(', ')}`,
        );
      evaluations.set(element, {
        value: Number.isInteger(raw) ? (raw as number) : 0,
        label: GRL_QUALITATIVE_LABELS.includes(label as GrlQualitativeLabel)
          ? (label as GrlQualitativeLabel)
          : 'None',
        ...(isRecord(evaluation.kpi) && {
          kpi: evaluation.kpi as Record<string, string | number>,
        }),
      });
    }
    return [
      {
        path: file.path,
        text: file.text,
        group,
        preferences,
        entry: {
          id: strategy.id,
          name: typeof strategy.name === 'string' ? strategy.name : strategy.id,
          includes: Array.isArray(strategy.includes)
            ? strategy.includes.filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
          evaluations,
        },
      },
    ];
  });
};

/**
 * Every strategy of a project's files, its includes resolved (included first,
 * recursively, as jUCMNav's `getRecursiveEvaluations`); a repeated id, an
 * unknown include and an include cycle are errors.
 */
export const readStrategies = (
  files: readonly ResourceFile[],
): { strategies: GrlStrategy[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const entries = files.flatMap((file) => readFile(file, diagnostics));
  const byId = new Map<string, Entry>();
  for (const entry of entries) {
    if (byId.has(entry.entry.id))
      diagnostics.push({
        path: entry.path,
        severity: 'error',
        message: `Strategy ${entry.entry.id} is defined twice`,
        ...keyRange(entry.text, entry.entry.id),
      });
    else byId.set(entry.entry.id, entry);
  }
  const resolve = (
    entry: Entry,
    trail: readonly string[],
  ): Map<string, GrlStrategyEvaluation> => {
    const evaluations = new Map<string, GrlStrategyEvaluation>();
    for (const include of entry.entry.includes) {
      const included = byId.get(include);
      if (!included || trail.includes(include)) {
        diagnostics.push({
          path: entry.path,
          severity: 'error',
          message: included
            ? `Strategy ${entry.entry.id} includes itself (through ${include})`
            : `Strategy ${entry.entry.id} includes unknown strategy ${include}`,
          ...keyRange(entry.text, include),
        });
        continue;
      }
      for (const [element, evaluation] of resolve(included, [
        ...trail,
        include,
      ]))
        evaluations.set(element, evaluation);
    }
    for (const [element, evaluation] of entry.entry.evaluations)
      evaluations.set(element, evaluation);
    return evaluations;
  };
  const strategies = [...byId.values()].map((entry): GrlStrategy => ({
    id: entry.entry.id,
    name: entry.entry.name,
    group: entry.group,
    path: entry.path,
    preferences: entry.preferences,
    evaluations: resolve(entry, [entry.entry.id]),
  }));
  return { strategies, diagnostics };
};

/** The project resource parser: the strategies as symbols (by name) and as data. */
export const parseStrategies: ProjectResourceParser<{
  strategies: { id: string; name: string; elements: string[] }[];
}> = (
  files,
): ParsedResource<{
  strategies: { id: string; name: string; elements: string[] }[];
}> => {
  const { strategies, diagnostics } = readStrategies(files);
  return {
    symbols: {
      strategies: strategies.map((strategy) => ({
        name: strategy.name,
        detail: `${strategy.group} (${strategy.evaluations.size} evaluations)`,
      })),
    },
    // JSON: it crosses to the language server
    data: {
      strategies: strategies.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        elements: [...strategy.evaluations.keys()],
      })),
    },
    diagnostics,
  };
};

/**
 * kaosexpert's project resources (goal-controller#190): the experts and the
 * calibration variables, which are not elements of the model (no node on
 * the canvas) but what its estimates are read with. Each kind is one JSON
 * file; the `.kaos` reader writes them from `declare expert` / `declare
 * calibration` (and `@experts.quantiles`), the writer writes them back.
 *
 * `experts.json`:
 *
 * ```json
 * {
 *   "quantiles": "(.1, .5, .9)",
 *   "experts": [{ "id": "expert1", "name": "Expert 1" }]
 * }
 * ```
 *
 * `quantiles` is `@experts.quantiles` as written: the cumulative
 * probabilities of the values an estimate `(q1, …, qn)` gives (default
 * `(.1, .5, .9)`, RE'15 and ADS).
 *
 * `calibrations.json`:
 *
 * ```json
 * {
 *   "calibrations": [
 *     {
 *       "id": "calibration1",
 *       "name": "Push Button Broken",
 *       "value": "4.37%",
 *       "estimates": { "expert1": "(3.81%, 4.28%, 4.76%)" }
 *     }
 *   ]
 * }
 * ```
 *
 * A calibration variable's `value` is its known value (a probability);
 * each expert's estimate is a `distribution` as written. `id` is left out
 * for one the file declares without an identifier (ADS's). Both kinds keep
 * attributes they have no key for as written (`kept`), which the writer
 * writes back. Values are kept as written, so the round trip is exact.
 */
import {
  jsonText,
  numberOf,
  readDistribution,
  targetId,
  type Distribution,
} from '@goal-controller/dialect';
import {
  keyRange,
  readJson,
  type EntryResourceParser,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';

export const EXPERTS_PATH = 'experts.json';
export const CALIBRATIONS_PATH = 'calibrations.json';
export const EVIDENCE_PATH = 'evidence.json';
export const DEFAULT_QUANTILES = '(.1, .5, .9)';

export type ExpertEntry = { id: string; name?: string; kept?: string[] };
export type ExpertsFile = { quantiles?: string; experts: ExpertEntry[] };

export type CalibrationEntry = {
  id?: string;
  name?: string;
  value?: string;
  estimates: Record<string, string>;
  kept?: string[];
};
export type CalibrationsFile = { calibrations: CalibrationEntry[] };

/** A file's text: two-space JSON, a final line break. */
export const expertsText = (file: ExpertsFile): string => jsonText(file);
export const calibrationsText = (file: CalibrationsFile): string =>
  jsonText(file);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as string[])
    : undefined;

/** `(.1, .5, .9)` as levels, ascending in (0, 1); null when it isn't such a list. */
export const quantileLevelsOf = (text: string): number[] | null => {
  const inner = /^\s*\(?([^()]*)\)?\s*$/.exec(text)?.[1];
  if (inner === undefined) return null;
  const levels = inner.split(',').map((part) => numberOf(part));
  return levels.length &&
    levels.every(
      (l, i): l is number =>
        l !== null && l > 0 && l < 1 && (i === 0 || l > levels[i - 1]!),
    )
    ? (levels as number[])
    : null;
};

/** The experts, as the files declare them, with what is wrong in them. */
export const readExperts = (
  files: readonly ResourceFile[],
): {
  experts: ExpertEntry[];
  quantiles: string;
  levels: number[];
  diagnostics: ResourceDiagnostic[];
} => {
  const diagnostics: ResourceDiagnostic[] = [];
  const experts: ExpertEntry[] = [];
  let quantiles: string | undefined;
  for (const file of files) {
    const { value, diagnostics: json } = readJson(file);
    diagnostics.push(...json);
    if (value === undefined) continue;
    const problem = (key: string, message: string) =>
      diagnostics.push({
        path: file.path,
        severity: 'error',
        message,
        ...keyRange(file.text, key),
      });
    if (!isRecord(value) || !Array.isArray(value.experts)) {
      problem('experts', 'An experts file has an `experts` list');
      continue;
    }
    if (value.quantiles !== undefined) {
      if (
        typeof value.quantiles !== 'string' ||
        !quantileLevelsOf(value.quantiles)
      )
        problem(
          'quantiles',
          'quantiles: the levels an estimate’s values are at, ascending in (0, 1): (.1, .5, .9)',
        );
      else quantiles = value.quantiles;
    }
    for (const entry of value.experts) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) {
        problem('experts', 'An expert has an `id`');
        continue;
      }
      if (experts.some((e) => e.id === entry.id))
        problem(entry.id, `Expert ${entry.id} is declared twice`);
      experts.push({
        id: entry.id,
        ...(typeof entry.name === 'string' && { name: entry.name }),
        ...(strings(entry.kept) && { kept: strings(entry.kept) }),
      });
    }
  }
  const written = quantiles ?? DEFAULT_QUANTILES;
  return {
    experts,
    quantiles: written,
    levels: quantileLevelsOf(written)!,
    diagnostics,
  };
};

/** A calibration variable read: its known value and each expert's estimate. */
export type Calibration = {
  /** its id, or its name's position when it has none (`#1`) */
  key: string;
  name: string;
  value: number | null;
  estimates: Map<string, Distribution>;
};

/** The calibration variables, as the files declare them, with what is wrong in them. */
export const readCalibrations = (
  files: readonly ResourceFile[],
): { calibrations: Calibration[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const calibrations: Calibration[] = [];
  for (const file of files) {
    const { value, diagnostics: json } = readJson(file);
    diagnostics.push(...json);
    if (value === undefined) continue;
    const problem = (
      key: string,
      message: string,
      severity: ResourceDiagnostic['severity'] = 'error',
    ) =>
      diagnostics.push({
        path: file.path,
        severity,
        message,
        ...keyRange(file.text, key),
      });
    if (!isRecord(value) || !Array.isArray(value.calibrations)) {
      problem('calibrations', 'A calibrations file has a `calibrations` list');
      continue;
    }
    for (const entry of value.calibrations) {
      if (!isRecord(entry)) {
        problem('calibrations', 'A calibration variable is an object');
        continue;
      }
      const key =
        typeof entry.id === 'string' && entry.id
          ? entry.id
          : `#${calibrations.length + 1}`;
      const name = typeof entry.name === 'string' ? entry.name : key;
      let known: number | null = null;
      if (typeof entry.value === 'string') {
        known = numberOf(entry.value);
        if (known === null || known < 0 || known > 1) {
          problem(
            'value',
            `Calibration ${name}: its value is a probability (4.37%), not ${entry.value}`,
          );
          known = null;
        }
      } else
        problem(
          'calibrations',
          `Calibration ${name} has no known value: it calibrates nothing`,
          'warning',
        );
      const estimates = new Map<string, Distribution>();
      if (isRecord(entry.estimates))
        for (const [expert, text] of Object.entries(entry.estimates)) {
          const read =
            typeof text === 'string'
              ? readDistribution(text)
              : { error: 'not a text' };
          if ('error' in read)
            problem(
              expert,
              `Calibration ${name}, ${expert}'s estimate: ${read.error}`,
            );
          else estimates.set(expert, read.distribution);
        }
      calibrations.push({ key, name, value: known, estimates });
    }
  }
  return { calibrations, diagnostics };
};

/** The experts as symbols (each by id, its name the detail), as entries (goal-controller#354) and as data. */
export const parseExperts: EntryResourceParser<
  'expert',
  {
    experts: { id: string; name: string }[];
    quantiles: string;
  }
> = (files) => {
  const { experts, quantiles, diagnostics } = readExperts(files);
  return {
    symbols: {
      experts: experts.map((e) => ({ name: e.id, detail: e.name ?? e.id })),
    },
    data: {
      experts: experts.map((e) => ({ id: e.id, name: e.name ?? e.id })),
      quantiles,
    },
    entries: experts.map((e) => ({
      id: targetId({ resource: 'expert' }, e.id),
      name: e.name ?? e.id,
    })),
    diagnostics,
  };
};

/**
 * An evidence item (goal-controller#199, HASE'11): no numeric content of
 * its own, what a leaf goal's `ESR` or a leaf obstacle's `Probability` is
 * based on (its `Evidence` key names it by id), traceability only.
 *
 * ```json
 * {
 *   "evidence": [
 *     { "id": "cyclicEndurance", "name": "Cyclic endurance test results with cyclic examination" }
 *   ]
 * }
 * ```
 */
export type EvidenceEntry = {
  id: string;
  name?: string;
  kind?: string;
  kept?: string[];
};
export type EvidenceFile = { evidence: EvidenceEntry[] };

export const evidenceText = (file: EvidenceFile): string => jsonText(file);

/** The evidence items, as the files declare them, with what is wrong in them. */
export const readEvidence = (
  files: readonly ResourceFile[],
): { evidence: EvidenceEntry[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const evidence: EvidenceEntry[] = [];
  for (const file of files) {
    const { value, diagnostics: json } = readJson(file);
    diagnostics.push(...json);
    if (value === undefined) continue;
    const problem = (key: string, message: string) =>
      diagnostics.push({
        path: file.path,
        severity: 'error',
        message,
        ...keyRange(file.text, key),
      });
    if (!isRecord(value) || !Array.isArray(value.evidence)) {
      problem('evidence', 'An evidence file has an `evidence` list');
      continue;
    }
    for (const entry of value.evidence) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) {
        problem('evidence', 'An evidence item has an `id`');
        continue;
      }
      if (evidence.some((e) => e.id === entry.id))
        problem(entry.id, `Evidence item ${entry.id} is declared twice`);
      evidence.push({
        id: entry.id,
        ...(typeof entry.name === 'string' && { name: entry.name }),
        ...(typeof entry.kind === 'string' && { kind: entry.kind }),
        ...(strings(entry.kept) && { kept: strings(entry.kept) }),
      });
    }
  }
  return { evidence, diagnostics };
};

/** The evidence items as symbols (by id, their name the detail) and as data. */
export const parseEvidence: ProjectResourceParser<{
  evidence: { id: string; name: string; kind?: string }[];
}> = (files) => {
  const { evidence, diagnostics } = readEvidence(files);
  return {
    symbols: {
      evidence: evidence.map((e) => ({
        name: e.id,
        detail: e.name ?? e.id,
      })),
    },
    data: {
      evidence: evidence.map((e) => ({
        id: e.id,
        name: e.name ?? e.id,
        ...(e.kind && { kind: e.kind }),
      })),
    },
    diagnostics,
  };
};

/** The calibration variables as symbols (by name, their known value the detail) and as data. */
export const parseCalibrations: ProjectResourceParser<{
  calibrations: { key: string; name: string; experts: string[] }[];
}> = (
  files,
): ParsedResource<{
  calibrations: { key: string; name: string; experts: string[] }[];
}> => {
  const { calibrations, diagnostics } = readCalibrations(files);
  return {
    symbols: {
      calibrations: calibrations.map((c) => ({
        name: c.name,
        detail: c.value === null ? 'no known value' : `known: ${c.value}`,
      })),
    },
    data: {
      calibrations: calibrations.map((c) => ({
        key: c.key,
        name: c.name,
        experts: [...c.estimates.keys()],
      })),
    },
    diagnostics,
  };
};
